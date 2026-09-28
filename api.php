<?php
declare(strict_types=1);

/*
 * SGT San Andrés API
 * IMPORTANTE: cambia ADMIN_PASSWORD antes de publicar. La contraseña se verifica
 * en el servidor con password_hash() y password_verify(); nunca se expone al JS.
 */
const ADMIN_PASSWORD = 'CAMBIA_ESTA_CLAVE_ADMIN_ANTES_DE_PUBLICAR';
const DATA_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'data';
const DATA_FILE = DATA_DIR . DIRECTORY_SEPARATOR . 'cotizaciones.json';
const SESSION_LIFETIME = 2592000; // 30 días

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
ini_set('session.gc_maxlifetime', (string)SESSION_LIFETIME);
session_set_cookie_params([
    'lifetime' => SESSION_LIFETIME,
    'path' => '/',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax'
]);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function ensure_storage(): void {
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0755, true) && !is_dir(DATA_DIR)) {
        throw new RuntimeException('No se pudo crear la carpeta data/. Revisa los permisos del hosting.');
    }
    if (!file_exists(DATA_FILE)) {
        $created = @file_put_contents(DATA_FILE, "[]\n", LOCK_EX);
        if ($created === false) throw new RuntimeException('No se pudo crear data/cotizaciones.json. Revisa los permisos de escritura.');
    }
}
function read_quotes(): array {
    ensure_storage();
    $raw = @file_get_contents(DATA_FILE);
    if ($raw === false) throw new RuntimeException('No se pudo leer cotizaciones.json. Revisa permisos y ruta.');
    $data = json_decode($raw, true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('data/cotizaciones.json tiene un formato inválido. Debe contener un arreglo JSON, por ejemplo [].');
    }
    return $data;
}
function with_quotes_lock(callable $callback) {
    ensure_storage();
    $fp = @fopen(DATA_FILE, 'c+');
    if (!$fp) throw new RuntimeException('No se pudo abrir cotizaciones.json para escritura. Revisa permisos de data/.');
    try {
        if (!flock($fp, LOCK_EX)) throw new RuntimeException('No se pudo bloquear el archivo de cotizaciones.');
        rewind($fp);
        $raw = stream_get_contents($fp);
        $data = json_decode($raw === false || trim($raw) === '' ? '[]' : $raw, true);
        if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) throw new RuntimeException('El archivo JSON está dañado. Restaura un arreglo JSON válido antes de continuar.');
        $result = $callback($data);
        $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) throw new RuntimeException('No se pudo codificar el archivo JSON.');
        rewind($fp);
        if (!ftruncate($fp, 0)) throw new RuntimeException('No se pudo limpiar el archivo para guardar.');
        if (fwrite($fp, $encoded . PHP_EOL) === false) throw new RuntimeException('No se pudo escribir la cotización en el archivo.');
        fflush($fp);
        flock($fp, LOCK_UN);
        return $result;
    } finally {
        fclose($fp);
    }
}
function json_input(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) respond(['ok'=>false,'message'=>'El cuerpo enviado no contiene JSON válido.'], 400);
    return $data;
}
function clean_text($value, int $max): string {
    if (!is_string($value) && !is_numeric($value)) return '';
    $value = trim((string)$value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    return substr($value, 0, $max);
}
function require_admin(): void {
    if (empty($_SESSION['sgt_admin']) || $_SESSION['sgt_admin'] !== true) respond(['ok'=>false,'message'=>'Sesión no válida. Inicia sesión nuevamente.'], 401);
}
function require_csrf(array $input): void {
    $token = isset($input['csrf']) && is_string($input['csrf']) ? $input['csrf'] : '';
    if (empty($_SESSION['csrf']) || !hash_equals((string)$_SESSION['csrf'], $token)) respond(['ok'=>false,'message'=>'Token de seguridad inválido. Actualiza la página e inicia sesión de nuevo.'], 403);
}
function find_index_by_id(array $quotes, string $id): int {
    foreach ($quotes as $i => $q) if (is_array($q) && isset($q['id']) && hash_equals((string)$q['id'], $id)) return (int)$i;
    return -1;
}
try {
    $action = isset($_GET['action']) ? clean_text($_GET['action'], 40) : '';
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    switch ($action) {
        case 'submit': {
            if ($method !== 'POST') respond(['ok'=>false,'message'=>'Método no permitido. Usa POST para enviar una cotización.'], 405);
            $in = json_input();
            $nombre = clean_text($in['nombre'] ?? '', 100);
            $correo = strtolower(clean_text($in['correo'] ?? '', 180));
            $servicio = clean_text($in['servicio'] ?? '', 160);
            $descripcion = clean_text($in['descripcion'] ?? '', 5000);
            $cantidad = filter_var($in['cantidad'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1,'max_range'=>100]]);
            $precio = clean_text($in['precio_referencia'] ?? '', 120);
            if ($nombre === '' || $correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL) || $servicio === '' || !$cantidad || mb_strlen_safe($descripcion) < 10) {
                respond(['ok'=>false,'message'=>'Revisa los campos: nombre, correo válido, servicio, cantidad entre 1 y 100 y descripción de al menos 10 caracteres.'], 422);
            }
            if ($precio === '') $precio = 'Por definir';
            $id = '';
            with_quotes_lock(function (&$quotes) use (&$id, $nombre, $correo, $servicio, $descripcion, $cantidad, $precio) {
                do { $id = 'SGT-' . strtoupper(bin2hex(random_bytes(4))); } while (find_index_by_id($quotes, $id) !== -1);
                $quotes[] = [
                    'id'=>$id, 'nombre'=>$nombre, 'correo'=>$correo, 'servicio'=>$servicio,
                    'cantidad'=>(int)$cantidad, 'precio_referencia'=>$precio, 'precio_final'=>'',
                    'descripcion'=>$descripcion, 'estado'=>'Pendiente', 'respuesta'=>'',
                    'fecha'=>date('Y-m-d H:i:s')
                ];
            });
            respond(['ok'=>true,'message'=>'Cotización enviada correctamente.','id'=>$id], 201);
        }
        case 'get': {
            if ($method !== 'GET') respond(['ok'=>false,'message'=>'Método no permitido.'], 405);
            $id = strtoupper(clean_text($_GET['id'] ?? '', 30));
            $correo = strtolower(clean_text($_GET['correo'] ?? '', 180));
            if ($id === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) respond(['ok'=>false,'message'=>'Introduce un ID y un correo electrónico válido.'], 422);
            $quotes = read_quotes();
            foreach ($quotes as $q) {
                if (is_array($q) && isset($q['id'],$q['correo']) && hash_equals(strtolower((string)$q['correo']), $correo) && hash_equals(strtoupper((string)$q['id']), $id)) {
                    respond(['ok'=>true,'cotizacion'=>['id'=>$q['id'],'servicio'=>$q['servicio']??'','estado'=>$q['estado']??'Pendiente','precio_final'=>$q['precio_final']??'','respuesta'=>$q['respuesta']??'','fecha'=>$q['fecha']??'']]);
                }
            }
            respond(['ok'=>false,'message'=>'No encontramos una cotización con ese ID y correo. Verifica los datos e inténtalo nuevamente.'], 404);
        }
        case 'login': {
            if ($method !== 'POST') respond(['ok'=>false,'message'=>'Método no permitido.'], 405);
            $in = json_input();
            $password = isset($in['password']) && is_string($in['password']) ? $in['password'] : '';
            // Hash generado en servidor; password_verify valida la contraseña enviada.
            $hash = password_hash(ADMIN_PASSWORD, PASSWORD_DEFAULT);
            if (!is_string($hash) || !password_verify($password, $hash)) {
                usleep(350000);
                respond(['ok'=>false,'message'=>'Contraseña incorrecta.'], 401);
            }
            session_regenerate_id(true);
            $_SESSION['sgt_admin'] = true;
            $_SESSION['sgt_last_activity'] = time();
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            respond(['ok'=>true,'message'=>'Sesión iniciada.','csrf'=>$_SESSION['csrf']]);
        }
        case 'logout': {
            if ($method !== 'POST') respond(['ok'=>false,'message'=>'Método no permitido.'], 405);
            $in=json_input(); require_admin(); require_csrf($in);
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $p=session_get_cookie_params();
                setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'] ?? '', (bool)$p['secure'], (bool)$p['httponly']);
            }
            session_destroy();
            respond(['ok'=>true,'message'=>'Sesión cerrada.']);
        }
        case 'list': {
            require_admin();
            if (time() - (int)($_SESSION['sgt_last_activity'] ?? 0) > SESSION_LIFETIME) {
                $_SESSION=[]; session_destroy(); respond(['ok'=>false,'message'=>'La sesión expiró. Inicia sesión nuevamente.'],401);
            }
            $_SESSION['sgt_last_activity']=time();
            $quotes=read_quotes();
            usort($quotes, function($a,$b){return strcmp((string)($b['fecha']??''),(string)($a['fecha']??''));});
            respond(['ok'=>true,'cotizaciones'=>$quotes]);
        }
        case 'update': {
            if ($method !== 'POST') respond(['ok'=>false,'message'=>'Método no permitido.'],405);
            $in=json_input();require_admin();require_csrf($in);
            $id=strtoupper(clean_text($in['id']??'',30));
            $estado=clean_text($in['estado']??'',20);
            $precio=clean_text($in['precio_final']??'',120);
            $respuesta=clean_text($in['respuesta']??'',5000);
            if ($id==='' || !in_array($estado,['Pendiente','Aprobada','Rechazada'],true)) respond(['ok'=>false,'message'=>'ID o estado no válido.'],422);
            $found=with_quotes_lock(function (&$quotes) use($id,$estado,$precio,$respuesta){
                $idx=find_index_by_id($quotes,$id);if($idx<0)return false;
                $quotes[$idx]['estado']=$estado;$quotes[$idx]['precio_final']=$precio;$quotes[$idx]['respuesta']=$respuesta;
                $quotes[$idx]['actualizada']=date('Y-m-d H:i:s');return true;
            });
            if(!$found)respond(['ok'=>false,'message'=>'No se encontró la cotización que intentas actualizar.'],404);
            respond(['ok'=>true,'message'=>'Cotización actualizada correctamente.']);
        }
        case 'delete': {
            if($method!=='POST')respond(['ok'=>false,'message'=>'Método no permitido.'],405);
            $in=json_input();require_admin();require_csrf($in);$id=strtoupper(clean_text($in['id']??'',30));
            if($id==='')respond(['ok'=>false,'message'=>'ID requerido.'],422);
            $found=with_quotes_lock(function (&$quotes) use($id){$idx=find_index_by_id($quotes,$id);if($idx<0)return false;array_splice($quotes,$idx,1);return true;});
            if(!$found)respond(['ok'=>false,'message'=>'No se encontró la cotización.'],404);
            respond(['ok'=>true,'message'=>'Cotización eliminada.']);
        }
        case 'delete_all': {
            if($method!=='POST')respond(['ok'=>false,'message'=>'Método no permitido.'],405);
            $in=json_input();require_admin();require_csrf($in);
            with_quotes_lock(function (&$quotes){$quotes=[];});
            respond(['ok'=>true,'message'=>'Todas las cotizaciones fueron eliminadas.']);
        }
        default: respond(['ok'=>false,'message'=>'Acción no válida. Usa action=submit, login, logout, list, update, get, delete o delete_all.'],400);
    }
} catch (Throwable $e) {
    error_log('[SGT API] '.$e->getMessage());
    respond(['ok'=>false,'message'=>$e instanceof RuntimeException ? $e->getMessage() : 'Error interno del servidor. Revisa el registro de errores PHP.'],500);
}
function mb_strlen_safe(string $value): int { return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value); }
?>