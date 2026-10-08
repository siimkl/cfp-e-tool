type Node = {
  id: string;
  x: number;
  y: number;
  lines: string[];
  kind?: 'decision' | 'terminal' | 'store' | 'exception';
  width?: number;
};
const nodes: Node[] = [
  {
    id: 'start',
    x: 380,
    y: 45,
    kind: 'terminal',
    lines: ['ALGUS · Google Apps Script', '04:00 / 16:00 või käsitsi käivitus'],
  },
  {
    id: 'lock',
    x: 380,
    y: 165,
    kind: 'decision',
    lines: ['Kas teine import', 'juba töötab?'],
  },
  {
    id: 'skipRun',
    x: 865,
    y: 165,
    kind: 'terminal',
    lines: [
      'Jah → jäta see käivitus vahele',
      'Paralleelset importi ei alustata',
    ],
  },
  {
    id: 'config',
    x: 380,
    y: 295,
    kind: 'decision',
    lines: ['Seaded ja Google’i', 'konto korras?'],
  },
  {
    id: 'stop',
    x: 865,
    y: 295,
    kind: 'exception',
    lines: ['Ei → logi viga ja lõpeta', 'Vabasta käivituse lukk'],
  },
  {
    id: 'gmail',
    x: 380,
    y: 425,
    lines: [
      'Gmail → kuni 30 viimast saabunud kirja',
      'Välja: saadetud kirjad ja mustandid',
    ],
  },
  {
    id: 'direct',
    x: 380,
    y: 555,
    kind: 'decision',
    lines: ['Otse meililistist', 'või uudiskirjast?'],
  },
  {
    id: 'count',
    x: 865,
    y: 555,
    kind: 'store',
    lines: [
      'Jah → uuenda allika kirjade loendust',
      'Iga Gmaili kiri loetakse üks kord',
    ],
  },
  {
    id: 'ledger',
    x: 380,
    y: 715,
    kind: 'decision',
    lines: ['Kiri lõplikult', 'töödeldud?'],
  },
  {
    id: 'skipMail',
    x: 865,
    y: 715,
    lines: ['Jah → jäta kiri vahele', 'Ka „leide pole” ja lõplik viga'],
  },
  {
    id: 'budget',
    x: 380,
    y: 875,
    kind: 'decision',
    lines: ['Tööaega on', 'veel alles?'],
  },
  {
    id: 'partial',
    x: 865,
    y: 875,
    kind: 'exception',
    lines: ['Ei → salvesta osalise töö kokkuvõte', 'Lõpeta ja vabasta lukk'],
  },
  {
    id: 'model',
    x: 380,
    y: 1015,
    lines: [
      'Märgi katse → OpenAI API',
      'Leia kirja tekstist CFP-d ja sündmused',
    ],
  },
  {
    id: 'valid',
    x: 380,
    y: 1155,
    kind: 'decision',
    lines: ['Vastus ja andmed', 'läbivad kontrolli?'],
  },
  {
    id: 'error',
    x: 865,
    y: 1155,
    kind: 'exception',
    lines: [
      'Ei / päring ebaõnnestus → märgi viga',
      'Kuni 3 töötluskatset, siis lõplik viga',
    ],
  },
  {
    id: 'found',
    x: 380,
    y: 1325,
    kind: 'decision',
    lines: ['Kas leiti mõni', 'kuulutus?'],
  },
  {
    id: 'empty',
    x: 865,
    y: 1325,
    lines: ['Ei → märgi „leide pole”', 'Seda kirja uuesti ei analüüsita'],
  },
  {
    id: 'duplicate',
    x: 380,
    y: 1475,
    kind: 'decision',
    lines: ['Kuulutus on', 'juba andmebaasis?'],
  },
  {
    id: 'merge',
    x: 865,
    y: 1475,
    lines: [
      'Jah → ühenda olemasolevaga',
      'Täienda puuduvat, säilita parandused',
    ],
  },
  {
    id: 'insert',
    x: 380,
    y: 1615,
    lines: ['Ei → lisa uus kuulutus', 'Iga leitud kuulutus eraldi kirjena'],
  },
  {
    id: 'save',
    x: 380,
    y: 1755,
    kind: 'store',
    lines: [
      'Supabase / PostgreSQL',
      'Salvesta kuulutused, allikad ja kirja olek',
    ],
  },
  {
    id: 'next',
    x: 380,
    y: 1905,
    kind: 'decision',
    lines: ['Veel töötlemata', 'kirju selles valimis?'],
  },
  {
    id: 'finish',
    x: 380,
    y: 2055,
    kind: 'terminal',
    lines: [
      'LÕPP · salvesta töö kokkuvõte',
      'Vabasta lukk; oota järgmist käivitust',
    ],
  },
  {
    id: 'web',
    x: 865,
    y: 1755,
    kind: 'store',
    lines: [
      'React → avalik tabel GitHub Pagesis',
      'Loeb Supabase’i lehe laadimisel',
    ],
  },
];

type Edge = {
  path: string;
  label?: string;
  x?: number;
  y?: number;
  dashed?: boolean;
};
const edges: Edge[] = [
  { path: 'M380 81 V110' },
  { path: 'M515 165 H675', label: 'Jah', x: 590, y: 150 },
  { path: 'M380 220 V240', label: 'Ei', x: 397, y: 238 },
  { path: 'M515 295 H675', label: 'Ei', x: 590, y: 280 },
  { path: 'M380 350 V389', label: 'Jah', x: 400, y: 375 },
  { path: 'M380 461 V500' },
  { path: 'M515 555 H675', label: 'Jah', x: 590, y: 540 },
  { path: 'M380 610 V660', label: 'Ei / ebaselge: ära loenda', x: 270, y: 638 },
  { path: 'M865 591 V635 H540 V650 H380 V660' },
  { path: 'M515 715 H675', label: 'Jah', x: 590, y: 700 },
  { path: 'M380 770 V820', label: 'Ei', x: 398, y: 800 },
  { path: 'M515 875 H675', label: 'Ei', x: 590, y: 860 },
  { path: 'M380 930 V979', label: 'Jah', x: 400, y: 960 },
  { path: 'M380 1051 V1100' },
  { path: 'M515 1155 H675', label: 'Ei', x: 590, y: 1140 },
  { path: 'M380 1210 V1270', label: 'Jah', x: 400, y: 1250 },
  { path: 'M515 1325 H675', label: 'Ei', x: 590, y: 1310 },
  { path: 'M380 1380 V1420', label: 'Jah', x: 400, y: 1407 },
  { path: 'M515 1475 H675', label: 'Jah', x: 590, y: 1460 },
  { path: 'M380 1530 V1579', label: 'Ei', x: 398, y: 1560 },
  { path: 'M380 1651 V1719' },
  { path: 'M865 1511 V1685 H380 V1719' },
  { path: 'M380 1791 V1850' },
  {
    path: 'M245 1905 H70 V875 H245',
    label: 'Jah → järgmine kiri',
    x: 155,
    y: 1878,
  },
  { path: 'M380 1960 V2019', label: 'Ei', x: 398, y: 1995 },
  { path: 'M1055 715 H1100 V1905 H515', dashed: true },
  { path: 'M1055 1155 H1100', dashed: true },
  { path: 'M1055 1325 H1100', dashed: true },
  { path: 'M570 1755 H675', label: 'Andmed', x: 615, y: 1740, dashed: true },
];

export function WorkflowDiagram() {
  return (
    <section className="workflow-diagram-section">
      <h2>Protsessi vooskeem</h2>
      <p>
        Romb tähistab otsust, kast töötlust ja sinine kast andmete salvestamist
        või kuvamist. Katkendjoon näitab andmete liikumist või kirja
        vahelejätmist.
      </p>
      <figure className="workflow-figure">
        <div
          className="workflow-scroll"
          role="region"
          aria-label="Protsessi vooskeem, vajadusel keri külgsuunas"
          tabIndex={0}
        >
          <svg
            viewBox="0 0 1140 2120"
            className="workflow-svg"
            role="img"
            aria-labelledby="workflow-title workflow-desc"
          >
            <title id="workflow-title">
              CFP ja sündmuste importimise protsess koos otsustuskohtadega
            </title>
            <desc id="workflow-desc">
              Protsess algab kell 04 või 16 või käsitsi. Kontrollitakse lukku ja
              seadistust. Gmailist valitakse kuni 30 kirja. Otse meililistist
              saabunud kirjad loendatakse allikate statistikas. Juba töödeldud
              kirjad jäetakse vahele. Tööaja olemasolul analüüsib OpenAI kirja.
              Kontrollitakse vastuse vormingut, kuupäevi, eestikeelseid
              kategooriaid ja linke. Vigased vastused lähevad korduskatsele,
              leidudeta kirjad märgitakse lõpetatuks. Duplikaadid ühendatakse,
              uued kuulutused lisatakse Supabase’i. See kordub iga kirja jaoks,
              seejärel salvestatakse töö kokkuvõte ja vabastatakse lukk. Avalik
              veebitabel loeb andmeid Supabase’ist.
            </desc>
            <defs>
              <marker
                id="workflow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#62776c" />
              </marker>
            </defs>
            {edges.map((edge, i) => (
              <g key={i}>
                <path
                  d={edge.path}
                  fill="none"
                  stroke="#62776c"
                  strokeWidth="2"
                  strokeDasharray={edge.dashed ? '6 5' : undefined}
                  markerEnd="url(#workflow-arrow)"
                />
                {edge.label && (
                  <text
                    x={edge.x}
                    y={edge.y}
                    textAnchor="middle"
                    className="flow-edge-label"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            ))}
            {nodes.map((node) => (
              <g
                key={node.id}
                className={`flow-node ${node.kind || 'process'}`}
              >
                {node.kind === 'decision' ? (
                  <path
                    d={`M${node.x} ${node.y - 55} L${node.x + 135} ${node.y} L${node.x} ${node.y + 55} L${node.x - 135} ${node.y} Z`}
                  />
                ) : (
                  <rect
                    x={node.x - 190}
                    y={node.y - 36}
                    width={380}
                    height={72}
                    rx={node.kind === 'terminal' ? 36 : 9}
                  />
                )}
                <text x={node.x} y={node.y - 8} textAnchor="middle">
                  {node.lines.map((line, index) => (
                    <tspan key={line} x={node.x} dy={index ? 23 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <figcaption>
          Mobiilis saab skeemi külgsuunas kerida. Allikate loendus ei otsusta,
          kas kirjast võib kuulutusi leida: ka edasisaadetud kiri jõuab
          mudelini, kui see vajab töötlust.
        </figcaption>
      </figure>
      <div className="info-note">
        <h3>Mida kontrollitakse?</h3>
        <ul>
          <li>
            <strong>Enne töötlust:</strong> õige Google’i konto, vajalikud
            seaded, paralleelse käivituse lukk ja kirja varasem töötlusolek.
          </li>
          <li>
            <strong>Mudeli vastuses:</strong> andmestruktuur, kuupäevad, CFP ja
            sündmuse väljade sobivus, eestikeelsed kategooriad ning kirjas
            leiduvad lingid.
          </li>
          <li>
            <strong>Enne salvestamist:</strong> võimalik duplikaat pealkirja,
            väljaandja, kuupäeva ja lingi põhjal. Tähtaega pikendatakse ainult
            selge pikendamisteate korral.
          </li>
          <li>
            <strong>Vea või ajalimiidi korral:</strong> ajutisi võrguvigu
            korratakse piiratud arv kordi. Lõpetamata kiri saab järgmisel
            käivitusel uue katse, kui see kuulub endiselt viimase 30 kirja
            hulka; pärast kolme töötluskatset automaatne kordamine lõpeb.
          </li>
        </ul>
      </div>
    </section>
  );
}
