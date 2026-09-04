"""La guardia de URL es la superficie de ataque del worker: aquí van los dientes."""

from __future__ import annotations

import pytest

from app.security import UrlRejected, assert_safe_url, resolve_public_host, validate_url


class TestValidateUrl:
    def test_acepta_http_y_https(self) -> None:
        assert validate_url("https://example.com/x") == "https://example.com/x"
        assert validate_url("http://example.com") == "http://example.com"

    def test_recorta_espacios(self) -> None:
        assert validate_url("  https://example.com  ") == "https://example.com"

    @pytest.mark.parametrize(
        "url",
        [
            "file:///etc/passwd",
            "ftp://example.com/x",
            "gopher://example.com",
            "data:text/plain,hola",
            "javascript:alert(1)",
        ],
    )
    def test_rechaza_esquemas_no_http(self, url: str) -> None:
        with pytest.raises(UrlRejected):
            validate_url(url)

    def test_rechaza_vacio(self) -> None:
        for value in ["", "   "]:
            with pytest.raises(UrlRejected):
                validate_url(value)

    def test_rechaza_sin_servidor(self) -> None:
        with pytest.raises(UrlRejected):
            validate_url("https:///solo-ruta")

    def test_rechaza_urls_desmesuradas(self) -> None:
        with pytest.raises(UrlRejected):
            validate_url("https://example.com/" + "a" * 3000)


class TestGuardiaSsrf:
    @pytest.mark.parametrize(
        "host",
        [
            "127.0.0.1",       # loopback
            "10.0.0.5",        # privada clase A
            "172.16.3.4",      # privada clase B
            "192.168.1.1",     # privada clase C
            "169.254.169.254", # metadatos de nube: el objetivo clásico
            "0.0.0.0",         # sin especificar
            "::1",             # loopback IPv6
            "fd00::1",         # ULA IPv6
        ],
    )
    def test_rechaza_ips_no_publicas(self, host: str) -> None:
        with pytest.raises(UrlRejected):
            resolve_public_host(host)

    def test_rechaza_ipv4_privada_mapeada_en_ipv6(self) -> None:
        # ::ffff:127.0.0.1 se colaría si solo se mirase la forma IPv6.
        with pytest.raises(UrlRejected):
            resolve_public_host("::ffff:127.0.0.1")

    def test_acepta_ip_publica_literal(self) -> None:
        assert resolve_public_host("1.1.1.1") == ["1.1.1.1"]

    def test_rechaza_host_que_resuelve_a_privada(self) -> None:
        # localhost resuelve a 127.0.0.1 (y/o ::1): el caso real del ataque.
        with pytest.raises(UrlRejected):
            resolve_public_host("localhost")

    def test_rechaza_host_inexistente(self) -> None:
        with pytest.raises(UrlRejected):
            resolve_public_host("no-existe.invalid")


class TestAssertSafeUrl:
    def test_bloquea_la_red_interna_de_punta_a_punta(self) -> None:
        for url in [
            "http://127.0.0.1:8080/health",
            "http://localhost/admin",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]:9000/",
        ]:
            with pytest.raises(UrlRejected):
                assert_safe_url(url)

    def test_allow_private_lo_desactiva_para_pruebas(self) -> None:
        assert assert_safe_url("http://127.0.0.1:8080/x", allow_private=True)
