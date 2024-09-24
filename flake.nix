{
  description = "Development shell for Lendasat";

  inputs = {
    nixpkgs.url      = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url  = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
          config = {
            allowUnfree = true;
          };
        };
        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        rustToolchainWithWasm = rustToolchain.override {
          # NOTE: I had to `yarn install --force` in `frontend-monorepo` after deleting `node_modules/borrower-wallet`.
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

        # Only for debugging a problem. Can remove.
        fwiSource = pkgs.fetchFromGitHub {
          owner = "Liamolucko";
          repo = "find_wasm_import";
          rev = "b726e870fcc30f59987ef59ad448ceb2d3dd998d";
          sha256 = "sha256-FKfU/xpE0zZDTlrj4wOVeqIACxWQquKmvaNnOk8n9dk=";
        };
        fwi = pkgs.rustPlatform.buildRustPackage {
          name = "find_wasm_import";
          src = fwiSource;
          cargoHash = "sha256-9GOx8xlGExwwgmnT7tx/d75LbxpRTifiIfw3715VGko=";
        };
      in
        {
          devShells.default = with pkgs; mkShell {
            # TODO: Trim these.
            buildInputs = [
              fwi
              gcc
              jq
              rustfmt
              rustAnalyzer
              nodejs
              yarn # Cannot easily use npm.
              openssl # TODO: Needed?
              pkg-config
              postgresql
              rustToolchainWithWasm
              wabt
              wasm-pack # Does not produce a valid `borrower-wallet` output.
            ];

            # TODO: rust-analyzer dies when we jump to the standard library and this does not fix it.
            RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
          };
        }
    );
}
