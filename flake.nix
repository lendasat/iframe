{
  description = "Development shell for Lendasat";

  inputs = {
    nixpkgs.url      = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/nixos-24.05";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url  = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, nixpkgs-stable, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ (import rust-overlay) ];
          config = {
            allowUnfree = true;
          };
        };
        pkgs-stable = import nixpkgs-stable { inherit system; };

        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        rustToolchainWithWasm = rustToolchain.override {
# NOTE: I had to `yarn install --force` in `frontend-monorepo` after deleting `node_modules/browser-wallet`.
          targets = [ "wasm32-unknown-unknown" ];
          # rust-src needs to match rustc's version for rust-analyzer to be able to use it.
          extensions = [ "rust-src" ];
        };

        rustBinNightly = (pkgs.rust-bin.selectLatestNightlyWith (toolchain: toolchain.minimal)).override {
          extensions = [ "rustfmt" "rust-analyzer" ];
        };

        # From nightly, we only want to use rusfmt and rust-analyzer. The rest of rustBinNightly is ignored.
        rustfmt = rustBinNightly.passthru.availableComponents.rustfmt;
        rustAnalyzer = rustBinNightly.passthru.availableComponents.rust-analyzer;

      in
        {
          devShells.default = with pkgs; mkShell {
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
}
