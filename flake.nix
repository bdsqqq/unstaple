{
  description = "extract attachments from gmail";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        unstaple = pkgs.callPackage ./nix/default.nix { };
      in
      {
        packages = {
          default = unstaple;
          unstaple = unstaple;
        };

        apps.default = {
          type = "app";
          program = "${unstaple}/bin/unstaple";
        };

        devShells.default = pkgs.mkShell {
          packages = [ pkgs.bun pkgs.nodejs ];
        };
      }
    );
}
