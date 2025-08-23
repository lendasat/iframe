{
  description = "Development shell for Lendasat";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixos-25.05";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
    naersk.url = "github:nix-community/naersk";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-stable,
    rust-overlay,
    flake-utils,
    naersk,
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
        packages = let
          # Common build function for hub
          buildHub = {
            release ? true,
            pname ? "hub",
          }:
            with pkgs; let
              naersk' = pkgs.callPackage naersk {
                cargo = rustToolchain;
                rustc = rustToolchain;
              };

              # Download swagger-ui for offline builds
              swagger-ui-zip = fetchurl {
                url = "https://github.com/swagger-api/swagger-ui/archive/refs/tags/v5.17.3.zip";
                sha256 = "sha256-zrb8feuuDzt/g6y7Tucfh+Y2BWZov0soyNPR5LBqKx4=";
              };
            in
              naersk'.buildPackage {
                inherit pname release;
                version = "0.6.0";

                src = ./.;

                cargoBuildOptions = opts: opts ++ ["--package" "hub"];

                # Build only the hub binary from the workspace
                buildAndTestSubdir = "hub";

                # Build dependencies
                nativeBuildInputs = [
                  pkg-config
                  unzip
                ];

                # Prepare swagger-ui files for the build
                preBuild = ''
                  export HOME=$(mktemp -d)
                  mkdir -p frontend/dist/apps/borrower
                  mkdir -p frontend/dist/apps/lender

                  # Create a writable temp directory for swagger-ui
                  export TMPDIR=$(mktemp -d)

                  # Copy and make the swagger-ui zip accessible
                  cp ${swagger-ui-zip} $TMPDIR/swagger-ui.zip
                  chmod 644 $TMPDIR/swagger-ui.zip

                  # Set the environment variable to the writable location
                  export SWAGGER_UI_DOWNLOAD_URL="file://$TMPDIR/swagger-ui.zip"

                  # Pre-extract swagger-ui to avoid permission issues
                  mkdir -p $TMPDIR/swagger-ui
                  cd $TMPDIR
                  ${unzip}/bin/unzip -q swagger-ui.zip || true
                  cd -
                '';

                buildInputs =
                  [
                    openssl
                  ]
                  ++ lib.optionals pkgs.stdenv.isDarwin [
                    pkgs.darwin.apple_sdk.frameworks.Security
                    pkgs.darwin.apple_sdk.frameworks.CoreFoundation
                  ];

                # Include database migrations
                postInstall = ''
                  mkdir -p $out/share/hub
                  cp -r hub/migrations $out/share/hub/
                '';

                # Skip tests for deployment build
                doCheck = false;

                meta = with lib; {
                  description = "Lendasat Hub - Bitcoin lending platform backend${lib.optionalString (!release) " (debug build)"}";
                  license = licenses.unfree;
                  platforms = platforms.linux ++ platforms.darwin;
                  mainProgram = "hub";
                };
              };
        in {
          # Release build (optimized)
          hub = buildHub {
            release = true;
            pname = "hub";
          };

          # Debug build (with debug symbols, no optimizations)
          hub-debug = buildHub {
            release = false;
            pname = "hub-debug";
          };

          # Default package points to release build
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
