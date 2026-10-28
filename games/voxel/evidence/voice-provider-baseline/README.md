# Configured LiveKit permission baseline

A temporary, uniquely named room used a generated identity and oscillator stream,
not school data, a user microphone, recording or a deployment. Actual LiveKit
1.12.0 Standard/protocol 17 connected and accepted a microphone-source track.
Server permission revocation unpublished it and disabled publishing. However,
both cached original and refreshed credentials rejoined with publish permission.
Explicit removal of a departed identity returned `not_found`; its cached tokens
still rejoined. A fresh listen-only token connected without publish permission.
The temporary room was deleted and its absence verified.

This is a reproduced revocation gap, not a passing moderation qualification.
The new adapter must prevent reusable SFU credentials reaching browsers and bind
fresh signaling admission to current school/media authority. The reports contain
no API secret or JWT. The source here is the exact isolated probe; its generated
credential-bearing temporary fixture was deleted and is not archived.
