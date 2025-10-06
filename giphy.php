<?php
// Allowed domains for CORS
$allowedDomains = [
    'example.com' // Replace with your actual domain
];

// Function to check if origin is allowed
function isOriginAllowed($origin, $allowedDomains) {
    if (empty($origin)) {
        return false;
    }
    
    // Extract domain from origin (remove protocol and port)
    $parsedOrigin = parse_url($origin);
    $domain = $parsedOrigin['host'] ?? '';
    
    // Check if domain is in allowed list
    return in_array($domain, $allowedDomains);
}

// Get the origin of the request (check multiple sources)
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';

// Extract domain from origin or referer
$requestDomain = '';
if (!empty($origin)) {
    $parsedOrigin = parse_url($origin);
    $requestDomain = $parsedOrigin['host'] ?? '';
} elseif (!empty($host)) {
    $requestDomain = $host;
}

// Check if the requesting domain is allowed
$isAllowed = false;
if (!empty($requestDomain)) {
    $isAllowed = in_array($requestDomain, $allowedDomains);
}

// Set CORS headers based on allowed domains
if ($isAllowed) {
    if (!empty($origin)) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        header("Access-Control-Allow-Origin: http://$requestDomain");
    }
} else {
    // For same-origin requests (no origin header), check if host is allowed
    if (empty($origin) && in_array($host, $allowedDomains)) {
        header("Access-Control-Allow-Origin: http://$host");
    } else {
        http_response_code(403);
        echo json_encode([
            'success' => false, 
            'message' => 'Access denied from this domain',
            'debug' => [
                'origin' => $origin,
                'host' => $host,
                'requestDomain' => $requestDomain,
                'allowedDomains' => $allowedDomains
            ]
        ]);
        exit;
    }
}

header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Giphy API configuration
$GIPHY_API_KEY = 'giphy_license_key';
$GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

// Fallback GIFs if API fails
$fallbackGifs = [
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif'
];

// Keywords for disappointed GIFs
$disappointedKeywords = [
    'disappointed',
    'sad',
    'facepalm',
    'sigh',
    'frustrated',
    'upset',
    'let down',
    'disappointed face',
    'sad face',
    'disappointed reaction'
];

function getRandomKeyword() {
    global $disappointedKeywords;
    return $disappointedKeywords[array_rand($disappointedKeywords)];
}

function getFallbackGifs() {
    global $fallbackGifs;
    return $fallbackGifs;
}

// Handle GET request for GIFs
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $keyword = isset($_GET['keyword']) ? $_GET['keyword'] : getRandomKeyword();
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    
    try {
        // Make request to Giphy API
        $url = $GIPHY_BASE_URL . '/search?api_key=' . $GIPHY_API_KEY . '&q=' . urlencode($keyword) . '&limit=' . $limit . '&rating=g&lang=en';
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'UserAgentName/1.0'
            ]
        ]);
        
        $response = file_get_contents($url, false, $context);
        
        if ($response === false) {
            throw new Exception('Failed to fetch from Giphy API');
        }
        
        $data = json_decode($response, true);
        
        if (isset($data['data']) && is_array($data['data']) && count($data['data']) > 0) {
            $gifs = array_map(function($gif) {
                return $gif['images']['original']['url'];
            }, $data['data']);
            
            echo json_encode([
                'success' => true,
                'gifs' => $gifs,
                'keyword' => $keyword,
                'count' => count($gifs)
            ]);
        } else {
            // No GIFs found, return fallback
            echo json_encode([
                'success' => true,
                'gifs' => getFallbackGifs(),
                'keyword' => $keyword,
                'count' => count(getFallbackGifs()),
                'fallback' => true
            ]);
        }
        
    } catch (Exception $e) {
        // Error occurred, return fallback GIFs
        echo json_encode([
            'success' => true,
            'gifs' => getFallbackGifs(),
            'keyword' => $keyword,
            'count' => count(getFallbackGifs()),
            'fallback' => true,
            'error' => $e->getMessage()
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method'
    ]);
}
?>
