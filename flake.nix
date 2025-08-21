{
  description = "Development shell for Lendasat";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixos-24.05";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-stable,
    rust-overlay,
    flake-utils,
    ...
  }: let
    # System-independent outputs (NixOS modules)
    systemIndependent = {
      nixosModules.default = {
        config,
        lib,
        pkgs,
        ...
      }: let
        cfg = config.services.lendasat;
      in {
        imports = [./modules/lendasat.nix];

        # Set the default package for the module
        config = lib.mkIf cfg.enable {
          services.lendasat.package = lib.mkDefault (
            if self.packages ? ${pkgs.system}
            then self.packages.${pkgs.system}.hub
            else throw "Lendasat hub package not available for system ${pkgs.system}"
          );
        };
      };

      # Convenience alias
      nixosModules.lendasat = self.nixosModules.default;
    };

    # System-dependent outputs
    systemDependent = flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [(import rust-overlay)];
          config = {
            allowUnfree = true;
          };
        };
        lib = pkgs.lib;
        pkgs-stable = import nixpkgs-stable {inherit system;};

        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        rustToolchainWithWasm = rustToolchain.override {
          # NOTE: I had to `yarn install --force` in `frontend` after deleting `node_modules/browser-wallet`.
          targets = ["wasm32-unknown-unknown"];
          # rust-src needs to match rustc's version for rust-analyzer to be able to use it.
          extensions = ["rust-src"];
        };

        rustBinNightly = (pkgs.rust-bin.selectLatestNightlyWith (toolchain: toolchain.minimal)).override {
          extensions = ["rustfmt" "rust-analyzer"];
        };

        # From nightly, we only want to use rusfmt and rust-analyzer. The rest of rustBinNightly is ignored.
        rustfmt = rustBinNightly.passthru.availableComponents.rustfmt;
        rustAnalyzer = rustBinNightly.passthru.availableComponents.rust-analyzer;
      in {
        packages = {
          # Main hub package
          hub = with pkgs; let
            rustPlatform' = makeRustPlatform {
              cargo = rust-bin.beta.latest.default;
              rustc = rust-bin.beta.latest.default;
            };

            # Download swagger-ui for offline builds
            swagger-ui-zip = fetchurl {
              url = "https://github.com/swagger-api/swagger-ui/archive/refs/tags/v5.17.3.zip";
              sha256 = "sha256-zrb8feuuDzt/g6y7Tucfh+Y2BWZov0soyNPR5LBqKx4=";
            };
          in
            rustPlatform'.buildRustPackage {
              pname = "hub";
              version = "0.6.0";

              src = ./.;

              cargoLock = {
                lockFile = ./Cargo.lock;
                outputHashes = {
                  "bitmex-stream-0.1.0" = "sha256-6UUMhogOfJAI1PMiXuOGvQKitwaDOZdL6kQ9DP2bUNA=";
                  "xtra-0.6.0" = "sha256-YIOjRc+Hzi0AKeFo21ztJR0ZDtEpfjHONKt9lptRL2A=";
                };
              };

              # Build only the hub binary from the workspace
              buildAndTestSubdir = "hub";

              nativeBuildInputs = [
                pkg-config
              ];

              # Set environment variables for swagger-ui build
              SWAGGER_UI_DOWNLOAD_URL = "file://${swagger-ui-zip}";

              buildInputs =
                [
                  openssl
                ]
                ++ lib.optionals pkgs.stdenv.isDarwin [
                  pkgs.darwin.apple_sdk.frameworks.Security
                  pkgs.darwin.apple_sdk.frameworks.CoreFoundation
                ];

              # Create empty frontend directories for build.rs
              preBuild = ''
                mkdir -p frontend/dist/apps/borrower
                mkdir -p frontend/dist/apps/lender
              '';

              # Include database migrations
              postInstall = ''
                mkdir -p $out/share/hub
                cp -r hub/migrations $out/share/hub/
              '';

              # Skip tests for deployment build
              doCheck = false;

              meta = with lib; {
                description = "Lendasat Hub - Bitcoin lending platform backend";
                license = licenses.unfree;
                platforms = platforms.linux ++ platforms.darwin;
              };
            };

          # Make default package point to hub
          default = self.packages.${system}.hub;
        };

        devShells.default = with pkgs;
          mkShell {
            # TODO: Trim these.
            buildInputs = [
              llvmPackages_latest.bintools
              worker-build
              gcc
              jq
              rustfmt
              rustAnalyzer
              nodejs_22
              yarn # Cannot easily use npm.
              pnpm
              corepack
              openssl # TODO: Needed?
              pkg-config
              postgresql
              rustToolchainWithWasm
              sqlx-cli
              wabt
              wasm-pack # Does not produce a valid `browser-wallet` output.
              binaryen
              wasm-bindgen-cli
              pkgs-stable.nodePackages.eslint
            ];

            RUST_SRC_PATH = "${rustToolchainWithWasm}/lib/rustlib/src/rust/library";
          };
      }
    );
  in
    # Merge system-independent and system-dependent outputs
    systemIndependent // systemDependent;
}
