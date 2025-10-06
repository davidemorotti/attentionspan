<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://example.com'); // Replace with your actual domain
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataFile = 'leaderboard_data.txt';
$maxEntries = 50;
$maxNameLength = 50;
$maxTimeValue = 86400; // 24 hours in seconds
$rateLimitFile = 'rate_limit.txt';

// Rate limiting function
function checkRateLimit($ip) {
    global $rateLimitFile;
    $rateLimitData = [];
    
    if (file_exists($rateLimitFile)) {
        $content = file_get_contents($rateLimitFile);
        $rateLimitData = json_decode($content, true) ?: [];
    }
    
    $currentTime = time();
    $ipKey = md5($ip);
    
    // Clean old entries (older than 1 hour)
    foreach ($rateLimitData as $key => $data) {
        if ($currentTime - $data['last_request'] > 3600) {
            unset($rateLimitData[$key]);
        }
    }
    
    // Check if IP has made too many requests
    if (isset($rateLimitData[$ipKey])) {
        if ($rateLimitData[$ipKey]['count'] >= 10 && 
            ($currentTime - $rateLimitData[$ipKey]['last_request']) < 3600) {
            return false;
        }
        $rateLimitData[$ipKey]['count']++;
        $rateLimitData[$ipKey]['last_request'] = $currentTime;
    } else {
        $rateLimitData[$ipKey] = ['count' => 1, 'last_request' => $currentTime];
    }
    
    file_put_contents($rateLimitFile, json_encode($rateLimitData));
    return true;
}

// Input validation and sanitization
function validateInput($name, $time) {
    global $maxNameLength, $maxTimeValue;
    
    // Validate name
    if (empty($name) || strlen($name) > $maxNameLength) {
        return false;
    }
    
    // Sanitize name (remove HTML tags and special characters)
    $name = strip_tags($name);
    $name = preg_replace('/[^a-zA-Z0-9\s\-_]/', '', $name);
    $name = trim($name);
    
    if (empty($name)) {
        return false;
    }
    
    // Validate time
    if (!is_numeric($time) || $time <= 0 || $time > $maxTimeValue) {
        return false;
    }
    
    return ['name' => $name, 'time' => intval($time)];
}

// Function to read leaderboard data
function readLeaderboardData() {
    global $dataFile;
    if (!file_exists($dataFile)) {
        return [];
    }
    
    $content = file_get_contents($dataFile);
    if (empty($content)) {
        return [];
    }
    
    $lines = explode("\n", trim($content));
    $data = [];
    
    foreach ($lines as $line) {
        if (!empty($line)) {
            $parts = explode('|', $line);
            if (count($parts) >= 3) {
                $data[] = [
                    'name' => htmlspecialchars($parts[0], ENT_QUOTES, 'UTF-8'),
                    'time' => intval($parts[1]),
                    'timestamp' => intval($parts[2]),
                    'date' => isset($parts[3]) ? htmlspecialchars($parts[3], ENT_QUOTES, 'UTF-8') : date('Y-m-d H:i:s', intval($parts[2]))
                ];
            }
        }
    }
    
    // Sort by time (descending - longest times first)
    usort($data, function($a, $b) {
        return $b['time'] - $a['time'];
    });
    
    return $data;
}

// Function to save leaderboard data
function saveLeaderboardData($data) {
    global $dataFile;
    
    $lines = [];
    foreach ($data as $entry) {
        $lines[] = $entry['name'] . '|' . $entry['time'] . '|' . $entry['timestamp'] . '|' . $entry['date'];
    }
    
    // Create backup before writing
    if (file_exists($dataFile)) {
        copy($dataFile, $dataFile . '.backup');
    }
    
    $result = file_put_contents($dataFile, implode("\n", $lines));
    
    if ($result === false) {
        // Restore backup if write failed
        if (file_exists($dataFile . '.backup')) {
            copy($dataFile . '.backup', $dataFile);
        }
        return false;
    }
    
    return true;
}

// Get client IP address
function getClientIP() {
    $ipKeys = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
    foreach ($ipKeys as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = $_SERVER[$key];
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// Handle POST request (add new entry)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $clientIP = getClientIP();
    
    // Check rate limit
    if (!checkRateLimit($clientIP)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Too many requests. Please try again later.']);
        exit;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['name']) && isset($input['time'])) {
        $validation = validateInput($input['name'], $input['time']);
        
        if ($validation) {
            $data = readLeaderboardData();
            
            // Add new entry
            $data[] = [
                'name' => $validation['name'],
                'time' => $validation['time'],
                'timestamp' => time(),
                'date' => date('Y-m-d H:i:s')
            ];
            
            // Keep only top entries
            if (count($data) > $maxEntries) {
                $data = array_slice($data, 0, $maxEntries);
            }
            
            if (saveLeaderboardData($data)) {
                echo json_encode(['success' => true, 'message' => 'Score saved successfully!']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to save score. Please try again.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid name or time']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Missing name or time']);
    }
}
// Handle GET request (retrieve leaderboard)
else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $data = readLeaderboardData();
    echo json_encode(['success' => true, 'data' => $data]);
}
else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
