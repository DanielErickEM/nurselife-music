# NurseLife Music Catalog

Panel web privado para publicar música en NurseLife.

## Publicar una canción

1. Abre el panel publicado en GitHub Pages e inicia sesión con la cuenta administradora de Firebase.
2. En `Conexión de GitHub`, pega un fine-grained personal access token de GitHub con permiso `Contents: Read and write` sobre este repositorio. El panel no guarda el token.
3. Elige portada y MP3, completa título/artista y pulsa `Subir y publicar canción`.
4. El panel sube ambos archivos a este repositorio y crea el documento en Firestore `catalogTracks`.

Los archivos publicados son públicos. Usa únicamente contenido propio, libre o autorizado.
Audios y portadas autorizados para NurseLife Music
