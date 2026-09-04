"""Lo que se puede probar de yt-dlp sin tocar la red: parseo y traducción."""

from __future__ import annotations

import pytest

from app.ytdlp import ProbeResult, _humanise, safe_filename


class TestSafeFilename:
    def test_conserva_un_titulo_normal(self) -> None:
        assert safe_filename("Canción de prueba", "mp3") == "Canción de prueba.mp3"

    @pytest.mark.parametrize("ch", list('<>:"/\\|?*'))
    def test_sustituye_caracteres_prohibidos(self, ch: str) -> None:
        assert ch not in safe_filename(f"a{ch}b", "mp3")

    def test_elimina_caracteres_de_control(self) -> None:
        assert "\n" not in safe_filename("a\nb", "mp3")
        assert "\x00" not in safe_filename("a\x00b", "mp3")

    def test_recorta_titulos_larguisimos(self) -> None:
        name = safe_filename("x" * 500, "mp3")
        assert len(name) <= 124

    def test_da_un_nombre_util_cuando_no_hay_titulo(self) -> None:
        assert safe_filename("", "mp3") == "audio.mp3"
        assert safe_filename("   ", "mp3") == "audio.mp3"
        # Un título de solo puntos dejaría un nombre inservible.
        assert safe_filename("...", "mp3") == "audio.mp3"

    def test_normaliza_la_extension(self) -> None:
        assert safe_filename("x", ".webm") == "x.webm"
        assert safe_filename("x", "") == "x.bin"


class TestProbeResult:
    def test_lee_duracion_numerica(self) -> None:
        assert ProbeResult({"duration": 213.4}).duration == pytest.approx(213.4)
        assert ProbeResult({"duration": 200}).duration == 200.0

    def test_duracion_ausente_o_ilegible_es_none(self) -> None:
        assert ProbeResult({}).duration is None
        assert ProbeResult({"duration": "largo"}).duration is None

    def test_detecta_directo_por_cualquiera_de_las_dos_señales(self) -> None:
        assert ProbeResult({"is_live": True}).is_live
        assert ProbeResult({"live_status": "is_live"}).is_live
        assert not ProbeResult({"live_status": "not_live"}).is_live
        assert not ProbeResult({}).is_live

    def test_prefiere_la_miniatura_directa(self) -> None:
        result = ProbeResult({"thumbnail": "https://x/a.jpg", "thumbnails": [{"url": "https://x/b.jpg"}]})
        assert result.thumbnail == "https://x/a.jpg"

    def test_elige_la_miniatura_mayor_de_la_lista(self) -> None:
        result = ProbeResult(
            {"thumbnails": [
                {"url": "https://x/small.jpg", "width": 120},
                {"url": "https://x/big.jpg", "width": 1280},
            ]}
        )
        assert result.thumbnail == "https://x/big.jpg"

    def test_sin_miniatura_devuelve_none(self) -> None:
        assert ProbeResult({}).thumbnail is None
        assert ProbeResult({"thumbnails": []}).thumbnail is None
        # Entradas sin url no deben romper la selección.
        assert ProbeResult({"thumbnails": [{"width": 10}]}).thumbnail is None


class TestHumanise:
    def test_traduce_el_bloqueo_por_ip_de_datacenter(self) -> None:
        msg = _humanise("ERROR: Sign in to confirm you're not a bot")
        assert "bot" in msg.lower()

    @pytest.mark.parametrize(
        "stderr,esperado",
        [
            ("ERROR: Private video", "privado"),
            ("ERROR: Video unavailable", "disponible"),
            ("ERROR: Unsupported URL: https://x", "extractor"),
        ],
    )
    def test_traduce_fallos_conocidos(self, stderr: str, esperado: str) -> None:
        assert esperado in _humanise(stderr).lower()

    def test_tiene_un_mensaje_por_defecto(self) -> None:
        assert _humanise("algo raro pasó") != ""
