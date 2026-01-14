{
  description = "Vitals - Personal Health Data Explorer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun          # Runtime and package manager
            sqlite       # Database CLI tools
          ];

          shellHook = ''
            echo "╔═══════════════════════════════════════════════════════════╗"
            echo "║  Vitals - Personal Health Data Explorer                  ║"
            echo "╚═══════════════════════════════════════════════════════════╝"
            echo ""
            echo "Available commands:"
            echo "  bun install        - Install dependencies"
            echo "  bun run db:init    - Initialize database"
            echo "  bun run import     - Import health data"
            echo "  bun run dev        - Start dev server (with watch mode)"
            echo "  bun run start      - Start production server"
            echo ""
          '';
        };
      }
    );
}
