{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "0.0.2";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-linux-x64";
      hash = "sha256-klqAYJTTqps4SdUt5UEVTkO+EF3V5CnM0U4gHZR32fY=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-linux-arm64";
      hash = "sha256-HylKaIz5WAbGzfLRQEYC6m8knLx+MMg7+l+Uu0QX0ug=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-darwin-x64";
      hash = "sha256-MkBiyyPQttcXuWRaxI+5fooh4n+UYr1VS4j6wfghFNw=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-darwin-arm64";
      hash = "sha256-yFtzDW6ILl7TRUIXBeou8T8k2r3+mnMNFKqrEHuKxxw=";
    };
  };

  currentSource = sources.${stdenvNoCC.hostPlatform.system} or (throw "unsupported system: ${stdenvNoCC.hostPlatform.system}");
in
stdenvNoCC.mkDerivation {
  pname = "unstaple";
  inherit version;

  src = fetchurl {
    inherit (currentSource) url hash;
  };

  dontUnpack = true;

  nativeBuildInputs = lib.optionals stdenvNoCC.isLinux [ autoPatchelfHook makeWrapper ];

  installPhase = ''
    runHook preInstall
    install -D -m 755 $src $out/bin/unstaple
    runHook postInstall
  '';

  meta = {
    description = "extract attachments from gmail";
    homepage = "https://github.com/bdsqqq/unstaple";
    license = lib.licenses.mit;
    maintainers = [ ];
    platforms = builtins.attrNames sources;
    mainProgram = "unstaple";
  };
}
