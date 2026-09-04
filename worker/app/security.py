"""Validación de la URL que llega del cliente.

El worker acepta una URL arbitraria y se la pasa a yt-dlp, así que hay que
tratarla como entrada hostil. Sin estas comprobaciones, cualquiera con acceso
al worker podría usarlo para sondear la red privada de quien lo hospeda o el
endpoint de metadatos del proveedor de nube.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit


class UrlRejected(ValueError):
    """La URL no es apta. El mensaje se muestra al usuario, así que es legible."""


ALLOWED_SCHEMES = {"http", "https"}

# Longitud generosa pero acotada: una URL de varios kB solo puede ser un abuso.
MAX_URL_LENGTH = 2048


def validate_url(raw: str) -> str:
    """Comprueba forma y esquema. Devuelve la URL normalizada."""
    if not raw or not raw.strip():
        raise UrlRejected("No has indicado ninguna URL.")

    url = raw.strip()
    if len(url) > MAX_URL_LENGTH:
        raise UrlRejected("La URL es demasiado larga.")

    parts = urlsplit(url)
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UrlRejected("Solo se admiten direcciones http y https.")
    if not parts.hostname:
        raise UrlRejected("La URL no tiene un servidor válido.")

    return url


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """`is_global` cubre privadas, loopback, enlace local, multicast y reservadas."""
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        return False
    if ip.is_multicast or ip.is_unspecified:
        return False
    # IPv6 mapeando una IPv4 privada: ::ffff:127.0.0.1 se colaría si no se mira.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        return _is_public_ip(mapped)
    return ip.is_global


def resolve_public_host(hostname: str) -> list[str]:
    """Resuelve el host y exige que **todas** sus IPs sean públicas.

    Se comprueban todas y no solo la primera: un host que devuelve una IP
    pública y otra privada serviría igualmente para alcanzar la red interna.

    Limitación conocida: yt-dlp vuelve a resolver por su cuenta, así que un
    ataque de DNS rebinding con TTL muy corto podría burlar esta comprobación.
    Detiene los casos directos, que son los que importan en un servicio que
    además va detrás de un token.
    """
    # Una IP literal se valida sin pasar por DNS.
    try:
        literal = ipaddress.ip_address(hostname.strip("[]"))
    except ValueError:
        literal = None

    if literal is not None:
        if not _is_public_ip(literal):
            raise UrlRejected("Esa dirección apunta a una red privada.")
        return [str(literal)]

    try:
        infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UrlRejected(f"No se pudo resolver el servidor «{hostname}».") from exc

    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise UrlRejected(f"No se pudo resolver el servidor «{hostname}».")

    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            raise UrlRejected("El servidor devolvió una dirección ilegible.") from None
        if not _is_public_ip(ip):
            raise UrlRejected("Esa dirección apunta a una red privada.")

    return sorted(addresses)


def assert_safe_url(raw: str, *, allow_private: bool = False) -> str:
    """Validación completa: forma, esquema y destino de red."""
    url = validate_url(raw)
    if not allow_private:
        resolve_public_host(urlsplit(url).hostname or "")
    return url
