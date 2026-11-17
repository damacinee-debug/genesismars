// Junta tudo em uma única página. Modos: (padrão) produção com biblioteca 3D do CDN; 'local' embute a cópia local para testes;
// 'pwa' gera index.html instalável (usa three.min.js do próprio repositório, manifest e service worker).
var fs = require('fs'), mode = process.argv[2] || 'prod', EX = process.env.THREE_EXAMPLES || '/home/claude/mrdoob/three.js/examples/js/';
var post = ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/UnrealBloomPass.js']
  .map(function (f) { return fs.readFileSync(EX + f, 'utf8'); }).join('\n');
var js = ['art', 'data', 'sim', 'gfx', 'models', 'render', 'ui'].map(function (f) { return fs.readFileSync('src/' + f + '.js', 'utf8'); }).join('\n');
if ((js + post).indexOf('</script') >= 0) throw new Error('script tag inside js');
var three = mode === 'pwa' ? '<script src="three.min.js"></script>' : mode === 'local' ? '<script>' + fs.readFileSync('/home/claude/mrdoob/three.js/build/three.min.js', 'utf8') + '</script>' : '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
var page = fs.readFileSync('src/page.html', 'utf8') + '\n' + three + '\n<script>\n/* three.js r128 examples (MIT): pós-processamento */\nif (window.THREE) {\n' + post + '\n}\n</script>\n<script>\n' + js + '\n</script>\n';
if (mode === 'local') page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page.replace(/<link[^>]*>/, '') + '</body></html>';
var hd = ''; if (mode === 'pwa') page = page.replace(/<title>[^<]*<\/title>|<link rel="stylesheet"[^>]*>|<meta name="claude:[^>]*>/g, function (m) { if (m.indexOf('claude:') < 0) hd += m; return ''; });
if (mode === 'pwa') page = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d0907"><meta name="description" content="Estratégia e colônia em Marte.">' +
  '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' +
  '' + hd + '<style>body{margin:0;background:#0d0907;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page + fs.readFileSync('src/pwa.html', 'utf8') + '</body></html>';
fs.writeFileSync(mode === 'local' ? 'local.html' : mode === 'pwa' ? 'index.html' : 'genesis-mars.html', page); console.log('ok', mode, page.length);
