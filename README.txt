SGT SAN ANDRÉS — SISTEMA DE COTIZACIONES
========================================

CONTENIDO
---------
index.html              Página pública, servicios, cotizador y consulta.
admin.html              Acceso y panel de administración.
style.css               Diseño responsive oscuro/RGB/neón.
script.js               Formulario público y consulta al servidor.
admin.js                Lógica del panel de administración.
api.php                 API PHP: guarda y consulta cotizaciones.
sw.js                   Caché de recursos estáticos (no almacena la API).
data/cotizaciones.json  Almacenamiento de cotizaciones.
data/.htaccess          Bloquea el acceso web directo a los datos.

REQUISITOS
----------
- Hosting con PHP 7.4 o superior (recomendado PHP 8.1+).
- Extensión JSON habilitada (normalmente viene incluida).
- Permiso de lectura/escritura de PHP sobre data/cotizaciones.json.
- HTTPS recomendado, especialmente para el acceso de administrador.

INSTALACIÓN
-----------
1. Antes de publicar, abre api.php y cambia la constante ADMIN_PASSWORD
   por una contraseña larga y exclusiva. La contraseña se verifica del lado
   del servidor mediante password_hash() y password_verify().
2. Sube todos los archivos y carpetas a la misma ubicación del hosting,
   conservando la estructura. La carpeta data debe estar junto a api.php.
3. Comprueba que PHP esté habilitado en esa ubicación.
4. Comprueba que data/cotizaciones.json exista y contenga exactamente [] como
   contenido inicial. El sistema intenta crear el archivo si no existe.
5. Da a PHP permisos de escritura en data/ y en cotizaciones.json. En hosting
   compartido, usa el administrador de archivos o consulta al proveedor. Evita
   permisos 777 si el hosting permite una alternativa más restrictiva.
6. Abre https://TU-DOMINIO/index.html.
7. Envía una cotización de prueba y guarda el ID SGT-XXXXXXXX.
8. Abre https://TU-DOMINIO/admin.html e inicia sesión con la contraseña que
   configuraste en api.php.
9. Comprueba que la solicitud aparezca en el panel. Se actualiza cada 3 segundos.
10. Cambia el estado, el precio final y la respuesta; pulsa Guardar cambios.
11. Regresa a la página pública, entra en Consultar cotización y usa el ID junto
    con el mismo correo registrado.

SEGURIDAD
---------
- No compartas la contraseña del administrador.
- No elimines data/.htaccess: protege el JSON frente a acceso directo por HTTP.
- Las operaciones administrativas requieren sesión PHP y token CSRF.
- El cliente consulta su solicitud mediante ID + correo.
- El archivo JSON contiene datos personales. Mantén el hosting actualizado y
  realiza copias de seguridad seguras.
- La sesión se configura para una duración de hasta 30 días; el navegador puede
  cerrarla antes según su configuración. Cierra sesión al terminar.
- El proyecto no usa Firebase ni localStorage para almacenar cotizaciones.
- El envío de correos no es necesario para guardar solicitudes. El botón mailto
  del panel abre el programa de correo del administrador.

SI APARECE “NO SE PUDO ENVIAR LA COTIZACIÓN”
--------------------------------------------
1. Verifica que PHP funcione abriendo https://TU-DOMINIO/api.php?action=...;
   una acción no válida debe responder con JSON, no con una página HTML.
2. Revisa permisos de data/ y data/cotizaciones.json.
3. Confirma que cotizaciones.json contenga JSON válido (por ejemplo []).
4. Revisa la versión PHP y el registro de errores del hosting.
5. En las herramientas del navegador (F12 > Network/Red), abre la solicitud
   POST api.php?action=submit y revisa el código HTTP y la respuesta JSON.
6. Si aparece “no devolvió JSON válido”, comprueba que PHP no esté imprimiendo
   warnings, errores o HTML antes del JSON y revisa el log del servidor.
7. Confirma que index.html, script.js y api.php estén en la misma carpeta y que
   no exista una regla del hosting que bloquee peticiones POST.

NOTAS
-----
- Los precios son referencias configurables en script.js; el servidor recibe
  esa etiqueta de referencia y valida los campos principales. El precio final
  se define en el panel.
- Si cambias los precios, actualiza el mapa `prices` en script.js.
- El service worker solo guarda archivos estáticos. Las llamadas a api.php se
  realizan siempre en línea para no mostrar datos antiguos como si fueran nuevos.
- El archivo admin.js es adicional a la estructura inicial para mantener el
  panel separado y organizado.
