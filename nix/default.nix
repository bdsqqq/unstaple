{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "0.0.1";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-linux-x64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # placeholder
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-linux-arm64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # placeholder
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-darwin-x64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # placeholder
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/unstaple/releases/download/v${version}/unstaple-darwin-arm64";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # placeholder
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
