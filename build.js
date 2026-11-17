// Junta tudo em uma única página. Modos: (padrão) produção com biblioteca 3D do CDN; 'local' embute a cópia local para testes.
var fs = require('fs'), mode = process.argv[2] || 'prod', EX = '/home/claude/mrdoob/three.js/examples/js/';
var post = ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/UnrealBloomPass.js']
  .map(function (f) { return fs.readFileSync(EX + f, 'utf8'); }).join('\n');
var js = ['art', 'data', 'sim', 'gfx', 'models', 'render', 'ui'].map(function (f) { return fs.readFileSync('src/' + f + '.js', 'utf8'); }).join('\n');
if ((js + post).indexOf('</script') >= 0) throw new Error('script tag inside js');
var three = mode === 'local' ? '<script>' + fs.readFileSync('/home/claude/mrdoob/three.js/build/three.min.js', 'utf8') + '</script>' : '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
var page = fs.readFileSync('src/page.html', 'utf8') + '\n' + three + '\n<script>\n/* three.js r128 examples (MIT): pós-processamento */\nif (window.THREE) {\n' + post + '\n}\n</script>\n<script>\n' + js + '\n</script>\n';
if (mode === 'local') page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page.replace(/<link[^>]*>/, '') + '</body></html>';
fs.writeFileSync(mode === 'local' ? 'local.html' : 'genesis-mars.html', page); console.log('ok', mode, page.length);
