// ============================================================
// DATA — todo o balanceamento, textos e conteúdo do jogo.
// Trocar nomes, custos ou falas aqui não exige mexer na lógica.
// ============================================================
var DATA = {
  lore: { game: 'Genesis Mars', year: 2032, company: 'SpaceZ', ship: 'Gênesis', ark: 'Alvorada', chapter: 'Capítulo I — A Contagem', chapter2: 'Capítulo II — Os Despertos' },

  bal: {
    N: 112,             // mapa N x N tiles (múltiplo de 8: o terreno é carregado em blocos de 8)
    solSec: 480,        // segundos reais por sol na velocidade 1x
    sunrise: 6, sunset: 18,
    start: { o2: 120, water: 60, food: 30, metal: 30, comp: 10, reg: 0, seeds: 0, ice: 0, research: 0, energy: 60 },
    cargo: { metal: 50, comp: 34, seeds: 12 },
    caps: { o2: 150, water: 80, food: 80, ice: 40, mat: 160, energy: 60 },
    landerUse: 2, netRadius: 9, revealR: 7, revealRGeo: 12,
    walk: 2.6,          // tiles por segundo (1x)
    carry: 10, suitHours: 8, o2PerHour: 10 / 24, mealFood: 1.25, drinkWater: 1.2, compStock: 70,
    sealedO2: 35, stableHours: 36, waterGoal: 30, o2Goal: 10,
    storm: false, stormT: 4 * 24 + 6, stormHours: 13, stormSolar: 0.2,   // tempestade fixa: amanhecer do sol 5
    criticalHours: 5,
    arrivalT: 6 * 24 + 6,          // a Alvorada chega no amanhecer do sol 7
    wakeHours: 5, gestHours: 40, birthFood: 12, birthWater: 12, maxPop: 26, weakHours: 20,
    arkCargo: { food: 60, water: 40, metal: 50, comp: 30, seeds: 10 }, arkStore: { food: 80, water: 60, mat: 120, o2: 60 }
  },

  chars: {
    elias: { name: 'Elias Ward', short: 'Elias', role: 'Biólogo e explorador', age: 34, quote: 'Talvez seja loucura… mas vale a pena tentar.', color: '#1f9aa6', dx: 1.5, dz: 2.5, job: 'bot',
      skills: { eng: 3, bot: 6, geo: 4, pil: 3, med: 3, sci: 3 },
      traits: [['Olhar do horizonte', 'Contemplar a paisagem devolve o dobro de calma.'], ['Mãos de terra', 'Biólogo de porte forte: planta e colhe 10% mais rápido.'], ['Medo silencioso', 'Estresse sobe quando o ar ou a comida ficam curtos.']] },
    helena: { name: 'Helena Vasquez', short: 'Helena', role: 'Engenheira de sistemas', age: 32, quote: 'A gente não veio só sobreviver. A gente veio ficar.', color: '#d9772b', dx: 2.5, dz: 2.5, job: 'eng',
      skills: { eng: 7, bot: 5, geo: 1, pil: 1, med: 2, sci: 5 },
      traits: [['Mãos firmes', 'Engenheira: constrói e repara 10% mais rápido.'], ['Humor seco', 'Conversar com ela alivia mais o estresse.'], ['Peso do controle', 'Estresse sobe quando algo quebra.']] }
  },
  skillNames: { eng: 'Engenharia', bot: 'Botânica', geo: 'Geologia', pil: 'Pilotagem', med: 'Medicina', sci: 'Ciência' },
  jobs: { eng: ['Construtor', '#e8792b'], bot: ['Agricultora', '#5fae4a'], geo: ['Minerador', '#c9a23a'], pil: ['Explorador', '#2aa5b0'], med: ['Médica', '#d94f4f'], sci: ['Cientista', '#5a8be0'] },
  jobKeys: ['eng', 'geo', 'bot', 'eng', 'sci', 'med'],

  // Os doze da Alvorada: despertam conforme houver leito livre. A ordem pode ser mudada pelo jogador.
  colonists: [
    { id: 'c1', name: 'Tomás Okafor', short: 'Tomás', age: 29, job: 'eng', role: 'Construtor', skills: { eng: 6, bot: 1, geo: 3, pil: 2, med: 1, sci: 2 }, trait: ['Mão de obra', 'Constrói rápido quando trabalha em grupo.'], why: 'Ergueu pontes a vida inteira. Quis erguer a primeira de outro mundo.' },
    { id: 'c2', name: 'Yuki Tanaka', short: 'Yuki', age: 31, job: 'bot', role: 'Agricultora', skills: { eng: 2, bot: 7, geo: 1, pil: 1, med: 2, sci: 3 }, trait: ['Dedo verde', 'Planta e colhe mais depressa.'], why: 'A fazenda da família virou deserto. Veio provar que um deserto pode virar fazenda.' },
    { id: 'c3', name: 'Rafael Monteiro', short: 'Rafael', age: 27, job: 'geo', role: 'Minerador', skills: { eng: 3, bot: 1, geo: 6, pil: 3, med: 1, sci: 2 }, trait: ['Faro para minério', 'Coleta rende mais.'], why: 'Cresceu em Minas, dentro de mina. Queria ver uma rocha que ninguém tocou.' },
    { id: 'c4', name: 'Amara Diallo', short: 'Amara', age: 35, job: 'med', role: 'Médica', skills: { eng: 1, bot: 3, geo: 1, pil: 1, med: 7, sci: 4 }, trait: ['Plantão', 'Quem acorda com ela por perto se recupera antes.'], why: 'Atendeu em três epidemias. Quer cuidar de um lugar que ainda não adoeceu.' },
    { id: 'c5', name: 'Lars Eriksen', short: 'Lars', age: 38, job: 'eng', role: 'Mecânico', skills: { eng: 7, bot: 1, geo: 2, pil: 3, med: 1, sci: 2 }, trait: ['Conserta tudo', 'Repara estruturas bem mais rápido.'], why: 'Nunca encontrou uma máquina que não quisesse abrir.' },
    { id: 'c6', name: 'Priya Nair', short: 'Priya', age: 30, job: 'sci', role: 'Cientista', skills: { eng: 2, bot: 2, geo: 3, pil: 1, med: 2, sci: 7 }, trait: ['Curiosa', 'Pesquisa rende mais.'], why: 'Passou dez anos lendo dados de sondas. Cansou de ler.' },
    { id: 'c7', name: 'Mateo Rivera', short: 'Mateo', age: 26, job: 'geo', role: 'Minerador', skills: { eng: 3, bot: 1, geo: 5, pil: 4, med: 1, sci: 1 }, trait: ['Fôlego', 'O ar do traje dura mais com ele.'], why: 'Era alpinista. Marte tem a maior montanha que existe.' },
    { id: 'c8', name: 'Chen Wei', short: 'Chen', age: 33, job: 'eng', role: 'Construtora', skills: { eng: 6, bot: 2, geo: 2, pil: 2, med: 1, sci: 3 }, trait: ['Planejadora', 'Obras em que ela trabalha desperdiçam menos.'], why: 'Desenhou cidades para milhões. Quer desenhar a primeira para dezenas.' },
    { id: 'c9', name: 'Sofia Lindqvist', short: 'Sofia', age: 28, job: 'bot', role: 'Agricultora', skills: { eng: 1, bot: 6, geo: 1, pil: 1, med: 3, sci: 3 }, trait: ['Paciência', 'Estresse sobe mais devagar.'], why: 'Guardava sementes num cofre no gelo. Veio abrir o cofre.' },
    { id: 'c10', name: 'Kwame Mensah', short: 'Kwame', age: 40, job: 'sci', role: 'Professor', skills: { eng: 2, bot: 2, geo: 2, pil: 1, med: 2, sci: 6 }, trait: ['Mestre', 'Com ele, a escola ensina mais.'], why: 'Deu aula por vinte anos. Quer dar a primeira aula de um mundo novo.' },
    { id: 'c11', name: 'Isabela Duarte', short: 'Isabela', age: 25, job: 'pil', role: 'Exploradora', skills: { eng: 2, bot: 1, geo: 4, pil: 6, med: 2, sci: 2 }, trait: ['Pé na estrada', 'Anda mais rápido fora da base.'], why: 'Nunca ficou dois anos na mesma cidade. Agora vai ficar a vida toda no mesmo planeta.' },
    { id: 'c12', name: 'Noor Haddad', short: 'Noor', age: 32, job: 'med', role: 'Geneticista', skills: { eng: 1, bot: 4, geo: 1, pil: 1, med: 6, sci: 5 }, trait: ['Guardiã do Berço', 'O Berço trabalha mais rápido com ela acordada.'], why: 'Acredita que uma civilização começa quando alguém nasce nela.' }
  ],
  bornNames: ['Aurora', 'Caio', 'Maré', 'Ícaro', 'Lia', 'Davi', 'Íris', 'Téo', 'Nara', 'Ravi', 'Luz', 'Otto', 'Maia', 'Zeca'],
  bairroNames: ['Vila Aurora', 'Vila Ferrugem', 'Bairro do Gelo', 'Vila Horizonte', 'Bairro dos Despertos'],

  // w,h em tiles · cost · t = segundos de obra (1x) · use/gen = energia por hora · prio = quem desliga por último
  buildings: {
    lander:  { name: 'Módulo de pouso', cat: null, w: 3, h: 3, desc: 'A nave Gênesis. Abrigo provisório e reserva inicial.', use: 2, prio: 10, press: true, beds: 2 },
    solar:   { name: 'Painel solar', cat: 'Energia', w: 2, h: 2, cost: { metal: 8, comp: 3 }, t: 12, gen: 14, desc: 'Gera energia de dia. A poeira reduz a eficiência.' },
    poste:   { name: 'Poste de energia', cat: 'Energia', w: 1, h: 1, cost: { metal: 4 }, t: 6, link: 30, desc: 'Leva a energia longe: alcança 30 m. Depois de colocar um, a ferramenta continua ativa para você ir puxando a linha até onde precisar.' },
    torre:   { name: 'Torre de luz', cat: 'Energia', w: 1, h: 1, cost: { metal: 8, comp: 2 }, t: 10, use: 0.5, prio: 2, desc: 'Ilumina uma área grande à noite, para enxergar e trabalhar na base.' },
    battery: { name: 'Bateria', cat: 'Energia', w: 1, h: 1, cost: { metal: 10, comp: 5 }, t: 14, cap: 130, desc: 'Guarda energia para a noite.' },
    airlock: { name: 'Câmara de descompressão', cat: 'Infraestrutura', w: 1, h: 1, cost: { metal: 12, comp: 4 }, t: 16, press: true, desc: 'Entrada e saída da área pressurizada. Comece o complexo por ela.' },
    corridor:{ name: 'Corredor pressurizado', cat: 'Infraestrutura', w: 1, h: 1, cost: { metal: 6 }, t: 7, press: true, needPress: true, desc: 'Liga módulos pressurizados.' },
    habitat: { name: 'Habitat', cat: 'Habitação', w: 3, h: 3, cost: { metal: 25, comp: 8, reg: 10 }, t: 30, use: 1.5, prio: 9, press: true, needPress: true, beds: 4, desc: 'Quatro leitos. Dormir, comer e recuperar. Aquecido e pressurizado.' },
    casa:    { name: 'Casa', cat: 'Habitação', w: 2, h: 2, cost: { metal: 14, comp: 4, reg: 8 }, t: 16, use: 0.4, prio: 9, press: true, selfPress: true, beds: 2, desc: 'Dois leitos, com câmara própria. Três casas vizinhas formam um bairro. Mais casas, mais gente.' },
    o2ext:   { name: 'Extrator de oxigênio', cat: 'Oxigênio', w: 2, h: 2, cost: { metal: 15, comp: 8 }, t: 20, use: 3, prio: 8, out: { o2: 2.4 }, desc: 'Tira O₂ do CO₂ da atmosfera marciana.' },
    o2tank:  { name: 'Tanque de oxigênio', cat: 'Oxigênio', w: 1, h: 1, cost: { metal: 10, comp: 2 }, t: 10, store: { o2: 90 }, desc: 'Aumenta a reserva de O₂.' },
    drill:   { name: 'Perfurador de gelo', cat: 'Água', w: 1, h: 1, cost: { metal: 18, comp: 8 }, t: 22, use: 3, prio: 5, out: { ice: 2.4 }, needIce: true, desc: 'Extrai gelo subterrâneo. Só funciona sobre gelo.' },
    purifier:{ name: 'Purificador de água', cat: 'Água', w: 2, h: 1, cost: { metal: 12, comp: 6 }, t: 16, use: 2, prio: 6, desc: 'Transforma gelo em água potável.' },
    wtank:   { name: 'Tanque de água', cat: 'Água', w: 1, h: 1, cost: { metal: 10, comp: 2 }, t: 10, store: { water: 90 }, desc: 'Aumenta a reserva de água.' },
    greenhouse:{ name: 'Estufa', cat: 'Agricultura', w: 3, h: 2, cost: { metal: 20, comp: 8, reg: 15 }, t: 30, use: 2.5, prio: 7, press: true, needPress: true, desc: 'Quatro canteiros. Produz alimento e um pouco de O₂.' },
    lab:     { name: 'Bancada de pesquisa', cat: 'Pesquisa', w: 2, h: 2, cost: { metal: 12, comp: 10 }, t: 20, use: 1.5, prio: 3, press: true, needPress: true, desc: 'Gera pesquisa quando alguém opera.' },
    workshop:{ name: 'Oficina', cat: 'Produção', w: 2, h: 2, cost: { metal: 20, comp: 6, reg: 10 }, t: 24, use: 3, prio: 2, desc: 'Faz componentes com regolito e metal.' },
    storage: { name: 'Armazém', cat: 'Armazenamento', w: 2, h: 2, cost: { metal: 10, reg: 10 }, t: 12, store: { mat: 160 }, desc: 'Mais espaço para materiais. Ponto de entrega.' },
    antenna: { name: 'Antena', cat: 'Comunicação', w: 1, h: 1, cost: { metal: 12, comp: 10 }, t: 20, use: 1, prio: 4, desc: 'Mensagens da Terra, telemetria da Alvorada e guia de pouso.' },
    pad:     { name: 'Zona de Pouso', cat: 'Comunicação', w: 4, h: 4, cost: { metal: 20, comp: 4, reg: 30 }, t: 40, use: 1, prio: 8, need: 'antenna', unique: true, desc: 'Onde a Alvorada pousa. Exige uma antena e precisa de energia para manter as cápsulas.' },
    cryo:    { name: 'Enfermaria criogênica', cat: 'Sociedade', w: 2, h: 2, cost: { metal: 18, comp: 12 }, t: 26, use: 2, prio: 8, press: true, needPress: true, desc: 'Desperta os colonos da Alvorada, um por vez, enquanto houver leito livre.' },
    berco:   { name: 'Berço', cat: 'Sociedade', w: 3, h: 3, cost: { metal: 40, comp: 25, reg: 20 }, t: 60, use: 4, prio: 7, press: true, selfPress: true, need: 'awake6', unique: true, desc: 'Onde nascem os primeiros marcianos. Trabalha quando há leito livre, comida e água.' },
    escola:  { name: 'Escola', cat: 'Sociedade', w: 3, h: 2, cost: { metal: 30, comp: 12, reg: 15 }, t: 40, use: 1.5, prio: 3, press: true, selfPress: true, need: 'berco', unique: true, desc: 'Todos aprendem mais rápido, e os nascidos em Marte ganham um ofício.' },
    jardim:  { name: 'Jardim Selado', cat: 'Marco', w: 4, h: 4, cost: { metal: 60, comp: 30, reg: 40 }, t: 80, landmark: true, desc: 'Marco de Era. Uma estufa monumental: a vida como fundação. Empurra para Marte e para a Vida.' },
    farol:   { name: 'Farol Profundo', cat: 'Marco', w: 4, h: 4, cost: { metal: 60, comp: 30, reg: 40 }, t: 80, landmark: true, desc: 'Marco de Era. Uma antena de longo alcance: a Terra nunca fica longe. Empurra para a Terra e a Ciência.' }
  },
  cats: ['Energia', 'Infraestrutura', 'Habitação', 'Sociedade', 'Oxigênio', 'Água', 'Agricultura', 'Pesquisa', 'Produção', 'Armazenamento', 'Comunicação', 'Marco'],

  crops: {
    batata: { name: 'Batata', hours: 40, water: 0.12, food: 12, o2: 0.05, desc: 'Lenta, rende muito.' },
    alface: { name: 'Alface', hours: 18, water: 0.16, food: 4, o2: 0.08, morale: 8, desc: 'Rápida, rende pouco, anima.' }
  },

  research: {
    limpeza: { name: 'Limpeza eletrostática', cost: 8, branch: 'Energia', desc: 'Painéis acumulam poeira bem mais devagar.' },
    celulas: { name: 'Células densas', cost: 10, branch: 'Energia', desc: 'Baterias guardam 50% mais.' },
    reciclagem: { name: 'Reciclagem de água', cost: 8, branch: 'Sobrevivência', desc: 'Cada pessoa gasta 40% menos água.' },
    trajes: { name: 'Trajes eficientes', cost: 10, branch: 'Sobrevivência', desc: 'O₂ do traje dura 60% mais.' },
    hidroponia: { name: 'Hidroponia básica', cost: 12, branch: 'Agricultura', desc: 'Plantas crescem 30% mais rápido com menos água.' },
    geologia: { name: 'Análise geológica', cost: 8, branch: 'Ciência', desc: 'Revela o terreno mais longe e a coleta rende 25% mais.' }
  },
  lockedResearch: ['Pequeno reator nuclear', 'Drone de transporte', 'Rover de exploração', 'Impressão 3D com regolito', 'Habitat subterrâneo', 'Busca por sinais de vida'],

  eras: [
    { n: 'I', name: 'Pouso', theme: 'Sobreviver' }, { n: 'II', name: 'Posto Avançado', theme: 'Permanecer' },
    { n: 'III', name: 'Assentamento', theme: 'Pertencer' }, { n: 'IV', name: 'Colônia', theme: 'Governar' }, { n: 'V', name: 'Civilização', theme: 'Transformar' }
  ],
  axes: { origem: ['Terra', 'Marte'], comunidade: ['Coletivo', 'Indivíduo'], planeta: ['Preservar', 'Transformar'] },
  traditions: [
    { id: 'cartas', axis: 'origem', sign: -1, name: 'Cartas para casa', desc: 'Toda semana, uma mensagem para a Terra. Moral mais alta.' },
    { id: 'solo', axis: 'origem', sign: 1, name: 'Solo nosso', desc: 'Marte não é missão, é endereço. Menos estresse.' },
    { id: 'mesa', axis: 'comunidade', sign: -1, name: 'Mesa única', desc: 'Ninguém come sozinho. Vínculo cresce mais rápido.' },
    { id: 'oficio', axis: 'comunidade', sign: 1, name: 'Cada um seu ofício', desc: 'Habilidades sobem mais rápido.' }
  ],

  chronicle: {
    landing: 'Sol 1 de {year}. A {ship}, da {company}, pousou em Marte com duas pessoas a bordo. Não há viagem de volta marcada.',
    firstPanel: 'Sol {sol}. {who} instalou o primeiro painel solar de Marte. Estava um pouco torto.',
    firstLight: 'Sol {sol}. O habitat acendeu. Pela primeira vez, uma janela iluminada em outro planeta.',
    iceFound: 'Sol {sol}. {who} encontrou gelo sob o regolito. A missão deixou de ter prazo de validade.',
    firstWater: 'Sol {sol}. A primeira água de Marte saiu do purificador. Eram poucos mililitros, e ninguém bebeu.',
    firstO2: 'Sol {sol}. O extrator produziu ar a partir do céu de Marte. Respirar deixou de ser estoque.',
    firstSprout: 'Sol {sol}. Um broto de {crop} rompeu o substrato. Marte deixou de ser completamente estéril.',
    firstHarvest: 'Sol {sol}. {who} colheu o primeiro alimento cultivado em Marte: {crop}.',
    stormStart: 'Sol {sol}. A primeira grande tempestade de poeira engoliu o horizonte.',
    stormEnd: 'Sol {sol}. A tempestade passou. A base estava coberta de pó, mas de pé.',
    tech: 'Sol {sol}. Nova técnica dominada: {what}.',
    choice: 'Sol {sol}. {what}',
    critical: 'Sol {sol}. {who} caiu, sem forças. Cada minuto contou.',
    rescued: 'Sol {sol}. {who} carregou {other} de volta ao abrigo.',
    death: 'Sol {sol}. {who} morreu em Marte. O planeta ganhou seu primeiro túmulo humano.',
    tradition: 'Sol {sol}. Nasceu um costume: {what}.',
    landmark: 'Sol {sol}. O {what} foi concluído. Começa a Era II: o Posto Avançado. O outro caminho ficou no papel.',
    sealed: 'Sol {sol}. A reserva lacrada do módulo foi aberta. Não existe outra.',
    lost: 'Sol {sol}. O silêncio voltou a Marte.',
    telemetry: 'Sol {sol}. Primeira telemetria da {ark}: doze sinais vitais, todos estáveis. Faltam cinco sóis.',
    orbit: 'Sol {sol}. A {ark} chegou e não encontrou onde pousar. Ficou em órbita, com doze pessoas dormindo.',
    arkLanded: 'Sol {sol}. A {ark} pousou em Marte com doze pessoas em criogenia. Elias e Helena deixaram de ser os únicos.',
    podLost: 'Sol {sol}. A cápsula de {who} falhou antes do despertar. A base não estava pronta.',
    firstAwake: 'Sol {sol}. {who} abriu os olhos em Marte: a primeira pessoa a acordar em um mundo onde não adormeceu.',
    awake6: 'Sol {sol}. Seis despertos. A base virou um lugar com gente demais para caber numa mesa só.',
    firstHouse: 'Sol {sol}. A primeira casa de Marte ficou pronta. Tinha dois leitos e uma porta que alguém podia chamar de sua.',
    bairro: 'Sol {sol}. Três casas vizinhas, e alguém deu nome ao lugar: {what}. O primeiro bairro marciano.',
    bairroN: 'Sol {sol}. Nasceu mais um bairro: {what}.',
    berco: 'Sol {sol}. O Berço foi ligado. Ninguém disse em voz alta o que aquilo significava.',
    firstBorn: 'Sol {sol}. {who} nasceu no Berço: a primeira pessoa de Marte. Nunca verá a Terra, e não sentirá falta.',
    escola: 'Sol {sol}. A primeira escola de Marte abriu. A primeira lição foi sobre como respirar lá fora.'
  },

  memories: {
    semAr: ['Quase sem ar', 'Lembra do alarme do traje. Sai menos tranquilo.'],
    broto: ['O primeiro broto', 'Viu o verde nascer. Moral um pouco mais alta.'],
    tempestade: ['Noite da tempestade', 'Já passou por isso. Tempestades pesam menos.'],
    resgate: ['Carregou o parceiro', 'Sabe do que é capaz.'],
    agua: ['A primeira água', 'Segurou Marte derretido nas mãos.'],
    despertou: ['Dormiu na Terra', 'Fechou os olhos em um planeta e abriu em outro.'],
    nascido: ['Nascido em Marte', 'Marte é o único chão que conhece.']
  },

  // Verbetes da Crônica: os recursos do jogo e o que eles são de verdade
  glossary: [
    ['Regolito', 'A camada de poeira, areia e fragmentos de rocha que cobre Marte e a Lua. Existe de verdade: os planos reais de colonização pensam em misturá-lo com aglutinantes ou fundi-lo para imprimir casas em 3D. Aqui ele é o tijolo marciano.'],
    ['Metal', 'Marte tem ferro em todo lugar; é o óxido de ferro que deixa o planeta vermelho. Rochas ricas em ferro, níquel e alumínio viram estruturas, painéis e ferramentas.'],
    ['Componentes', 'Peças eletrônicas e mecânicas: cabos, placas, válvulas, motores pequenos. Vieram poucas da Terra; o resto a oficina fabrica com metal e regolito.'],
    ['Gelo', 'Há água congelada sob o solo de Marte, às vezes a poucos centímetros da superfície, e nas calotas polares. O perfurador tira o gelo e o purificador o derrete e limpa.'],
    ['Água', 'Para beber, regar a estufa e, no futuro, fazer oxigênio e combustível. Em Marte, cada litro é reciclado.'],
    ['Oxigênio', 'A atmosfera de Marte é quase toda gás carbônico. O extrator quebra o CO₂ e separa o oxigênio, como fez de verdade o experimento MOXIE no rover Perseverance em 2021.'],
    ['Alimento', 'Batata e alface crescem na estufa, protegidas do frio e da radiação. O solo marciano precisa ser lavado dos percloratos antes de servir de cultivo.'],
    ['Sementes', 'Vieram da Terra em cápsulas seladas. Cada colheita devolve sementes para o próximo plantio.'],
    ['Energia', 'Em Marte o Sol chega com menos da metade da força que na Terra, e a poeira cobre os painéis. Baterias guardam o dia para a noite.']
  ],

  // Objetivos do tutorial: aparecem os 3 primeiros ainda não cumpridos.
  tutorial: [
    { id: 'inspect', text: 'Selecione Elias (clique) e clique com o botão direito no módulo de pouso para inspecioná-lo' },
    { id: 'unload', text: 'Clique de novo no módulo com o botão direito para retirar os suprimentos' },
    { id: 'solar', text: 'Construa 2 painéis solares (menu Energia, embaixo)' },
    { id: 'battery', text: 'Construa uma bateria perto do módulo' },
    { id: 'gather', text: 'Colete regolito e metal: botão direito num depósito (o habitat pede 10 de regolito)' },
    { id: 'airlock', text: 'Construa uma câmara de descompressão' },
    { id: 'habitat', text: 'Construa o habitat encostado na câmara' },
    { id: 'workshop', text: 'Construa uma oficina: ela fabrica componentes com regolito e metal' },
    { id: 'ice', text: 'Explore a noroeste: os sensores indicam gelo' },
    { id: 'drill', text: 'Instale um perfurador sobre o gelo com 2 painéis solares e uma bateria ao lado (ou leve uma linha de postes de energia)' },
    { id: 'water', text: 'Construa um purificador e produza água' },
    { id: 'o2', text: 'Construa um extrator de oxigênio' },
    { id: 'greenhouse', text: 'Construa a estufa encostada no complexo' },
    { id: 'plant', text: 'Plante batatas (selecione a estufa)' },
    { id: 'antenna', text: 'Construa uma antena: ela guia o pouso da Alvorada' },
    { id: 'pad', text: 'Construa a Zona de Pouso (menu Comunicação) antes do sol 7' },
    { id: 'casas', text: 'Construa casas para os 12 colonos (cada casa tem 2 leitos)' },
    { id: 'cryo', text: 'Construa a Enfermaria criogênica encostada no complexo (menu Sociedade)' },
    { id: 'arrival', text: 'Receba a Alvorada no amanhecer do sol 7' },
    { id: 'wake', text: 'Desperte 6 colonos: cada um precisa de um leito livre (habitat ou casas)' },
    { id: 'bairro', text: 'Forme o primeiro bairro: 3 casas vizinhas' },
    { id: 'berco', text: 'Construa o Berço (menu Sociedade)' },
    { id: 'born', text: 'Mantenha leito, comida e água até nascer o primeiro marciano' },
    { id: 'escola', text: 'Construa a Escola' },
    { id: 'landmark', text: 'Cumpra os requisitos da Era e erga um Marco' }
  ],

  dialogues: [
    { id: 'painel', cond: 'firstPanel', lines: [['elias', 'Você acha que alguém vai lembrar quem colocou o primeiro painel aqui?'], ['helena', 'Se você instalar ele torto, com certeza.']] },
    { id: 'silencio', cond: 'early', lines: [['elias', 'Nunca ouvi um silêncio desse tamanho.'], ['helena', 'Aproveita. Quando o extrator ligar, acabou.']] },
    { id: 'comida', cond: 'lowFood', lines: [['helena', 'Fiz as contas da comida três vezes.'], ['elias', 'E?'], ['helena', 'Na quarta eu parei de fazer.']] },
    { id: 'ar', cond: 'lowO2', lines: [['elias', 'O medidor de O₂ está me olhando feio.'], ['helena', 'Ele olha assim pra todo mundo. Vamos resolver.']] },
    { id: 'noite', cond: 'night', lines: [['elias', 'Dá pra ver a Terra daqui. Aquele ponto azulado.'], ['helena', 'Sete bilhões de pessoas num pixel.']] },
    { id: 'tempestade', cond: 'storm', lines: [['helena', 'Os painéis estão recebendo um quinto da luz.'], ['elias', 'Então a gente recebe um quinto do medo.'], ['helena', 'Não funciona assim.']] },
    { id: 'estufa', cond: 'growing', lines: [['helena', 'Não fala com as plantas.'], ['elias', 'Elas são as únicas vizinhas que a gente tem.']] },
    { id: 'agua', cond: 'water', lines: [['elias', 'Essa água ficou congelada três bilhões de anos.'], ['helena', 'E a gente vai usar pra regar batata. Progresso.']] },
    { id: 'vinculo', cond: 'bondHigh', lines: [['helena', 'Quando eu surtar, você avisa?'], ['elias', 'Aviso. E você me avisa quando eu ficar quieto demais.']] },
    { id: 'tensao', cond: 'bondLow', lines: [['helena', 'Você mexeu na minha bancada.'], ['elias', 'É a única bancada do planeta, Helena.']] },
    { id: 'dias', cond: 'sol5', lines: [['elias', 'Cinco sóis. Já somos os moradores mais antigos daqui.'], ['helena', 'E os únicos. Não deixa subir à cabeça.']] },
    { id: 'spacez', cond: 'antenna', lines: [['helena', 'A SpaceZ quer fotos da base para os investidores.'], ['elias', 'Manda a do painel torto.']] }
  ],

  // Eventos com escolha. cond e fx são resolvidos por nome em Sim.EV.
  events: [
    { id: 'leak', title: 'Vazamento no habitat', text: 'Um chiado fino atrás do painel de serviço. A pressão cai devagar. O₂ está escapando.',
      choices: [
        { label: 'Helena repara agora', hint: 'Definitivo. Helena fica exausta e tensa.' },
        { label: 'Elias faz um remendo', hint: 'Rápido. Pode voltar.' },
        { label: 'Usar peças de reserva', hint: 'Custa 6 componentes. Definitivo.' }
      ] },
    { id: 'earthMsg', title: 'Mensagem da Terra', text: 'A SpaceZ repassa um pacote de mensagens pessoais: família, amigos, uma turma de escola inteira. Baixar tudo custa energia que hoje faz falta.',
      choices: [
        { label: 'Baixar e responder', hint: 'Gasta 15 de energia. Moral sobe. Aproxima da Terra.' },
        { label: 'Guardar a energia', hint: 'Nada se perde hoje. Aproxima de Marte.' }
      ] },
    { id: 'conflict', title: 'Discussão', text: 'Dias de trabalho sem pausa. Uma ferramenta fora do lugar vira uma discussão sobre tudo. Os dois param, cada um num canto do módulo.',
      choices: [
        { label: 'Parar e conversar', hint: 'Perde algumas horas. Vínculo melhora.' },
        { label: 'Cada um no seu trabalho', hint: 'Sem pausa. Vínculo piora. Aproxima do Indivíduo.' }
      ] },
    { id: 'horizon', title: 'O horizonte', text: 'O Sol se põe pequeno e azul. Elias parou de trabalhar e está só olhando. Helena percebe.',
      choices: [
        { label: 'Parar e olhar juntos', hint: 'Estresse cai nos dois. Vínculo sobe.' },
        { label: 'Chamar de volta ao trabalho', hint: 'Nada se perde. Elias guarda para si.' }
      ] },
    { id: 'rare', title: 'Mineral raro', text: 'Uma veia escura numa rocha partida: metais que valeriam uma fortuna na Terra. Extrair tudo destrói a formação, que parece muito antiga.',
      choices: [
        { label: 'Extrair tudo', hint: '+30 metal, +10 componentes. Aproxima de Transformar.' },
        { label: 'Tirar amostras e preservar', hint: '+6 de pesquisa. Aproxima de Preservar.' }
      ] },
    { id: 'ration', title: 'A última semana de comida', text: 'A despensa cabe numa prateleira. Quem trabalha fora gasta mais; dividir igual é mais justo.',
      choices: [
        { label: 'Dividir igualmente', hint: 'Vínculo sobe. Aproxima do Coletivo.' },
        { label: 'Priorizar quem trabalha fora', hint: 'Elias rende mais, Helena se ressente. Aproxima do Indivíduo.' }
      ] },
    { id: 'frozen', title: 'Perfurador congelado', text: 'A broca travou no gelo durante a madrugada. Forçar pode quebrar; esperar o sol custa horas de produção.',
      choices: [
        { label: 'Aquecer com energia da base', hint: 'Gasta 20 de energia. Volta já.' },
        { label: 'Esperar o sol', hint: 'Perfurador parado por 6 horas.' }
      ] },
    { id: 'sealed', title: 'Reserva lacrada', text: 'O oxigênio da base acabou. No fundo do módulo de pouso existe um cilindro lacrado, para uma única emergência. É esta.',
      choices: [{ label: 'Romper o lacre', hint: 'Oxigênio de emergência. Não haverá outra.' }] }
  ]
};
if (typeof module !== 'undefined') module.exports = DATA;
