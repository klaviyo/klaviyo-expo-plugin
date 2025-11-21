{
  description = "Klaviyo Expo Plugin";
  inputs = {
    nixpkgs = {
      url = "github:NixOS/nixpkgs/nixos-25.05";
    };
    utils = {
      url = "github:numtide/flake-utils";
    };
  };
  outputs =
    {
      nixpkgs,
      utils,
      ...
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            lefthook
            nixfmt-rfc-style
          ];

          shellHook = ''
            if [ -f lefthook.yml ] && [ ! -f .git/hooks/pre-commit ]; then
                lefthook install
            fi
          '';
        };
      }
    );
}
