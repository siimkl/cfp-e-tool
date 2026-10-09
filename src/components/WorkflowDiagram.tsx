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
    lines: [
      'Postkasti kontroll algab',
      'Umbes kell 04:00 ja 16:00 või käsitsi',
    ],
  },
  {
    id: 'lock',
    x: 380,
    y: 165,
    kind: 'decision',
    lines: ['Kas postkasti juba', 'kontrollitakse?'],
  },
  {
    id: 'skipRun',
    x: 865,
    y: 165,
    kind: 'terminal',
    lines: ['Lõpeta see käivitus', 'Varem alustatud kontroll jätkub'],
  },
  {
    id: 'config',
    x: 380,
    y: 295,
    kind: 'decision',
    lines: ['Kas konto ja', 'seaded on õiged?'],
  },
  {
    id: 'stop',
    x: 865,
    y: 295,
    kind: 'exception',
    lines: ['Salvesta veateade ja lõpeta', 'Haldur saab põhjuse üle vaadata'],
  },
  {
    id: 'gmail',
    x: 380,
    y: 425,
    lines: [
      'Võta kuni 30 viimast saabunud kirja',
      'Saadetud kirju ja mustandeid ei loeta',
    ],
  },
  {
    id: 'direct',
    x: 380,
    y: 555,
    kind: 'decision',
    lines: ['Kas kiri tuli', 'otse meililistist?'],
  },
  {
    id: 'count',
    x: 865,
    y: 555,
    kind: 'store',
    lines: ['Lisa kiri allika statistikasse', 'Sama kirja ei loeta mitu korda'],
  },
  {
    id: 'ledger',
    x: 380,
    y: 715,
    kind: 'decision',
    lines: ['Kas selle kirjaga', 'on juba lõpetatud?'],
  },
  {
    id: 'skipMail',
    x: 865,
    y: 715,
    lines: ['Jäta see kiri vahele', 'Jätka järgmise kirjaga'],
  },
  {
    id: 'budget',
    x: 380,
    y: 875,
    kind: 'decision',
    lines: ['Kas jätkamiseks', 'on veel aega?'],
  },
  {
    id: 'partial',
    x: 865,
    y: 875,
    kind: 'exception',
    lines: [
      'Salvesta senise töö kokkuvõte',
      'Lõpeta praegune postkasti kontroll',
    ],
  },
  {
    id: 'model',
    x: 380,
    y: 1015,
    lines: [
      'Lase keelemudelil kiri läbi vaadata',
      'Leia CFP-d, sündmused ja nende andmed',
    ],
  },
  {
    id: 'valid',
    x: 380,
    y: 1155,
    kind: 'decision',
    lines: ['Kas vastus sobib', 'salvestamiseks?'],
  },
  {
    id: 'error',
    x: 865,
    y: 1155,
    kind: 'exception',
    lines: [
      'Salvesta veateade',
      'Jätka järgmise kirjaga; proovi hiljem uuesti',
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
    lines: [
      'Märgi kiri läbivaadatuks',
      'Kuulutusi ei leitud; jätka järgmise kirjaga',
    ],
  },
  {
    id: 'duplicate',
    x: 380,
    y: 1475,
    kind: 'decision',
    lines: ['Kas sama kuulutus', 'on juba olemas?'],
  },
  {
    id: 'merge',
    x: 865,
    y: 1475,
    lines: [
      'Täienda olemasolevat kuulutust',
      'Säilita halduri tehtud parandused',
    ],
  },
  {
    id: 'insert',
    x: 380,
    y: 1615,
    lines: ['Lisa uus kuulutus', 'Igale CFP-le ja sündmusele oma tabelirida'],
  },
  {
    id: 'save',
    x: 380,
    y: 1755,
    kind: 'store',
    lines: ['Salvesta kuulutused ja allikaviited', 'Märgi kiri läbivaadatuks'],
  },
  {
    id: 'next',
    x: 380,
    y: 1905,
    kind: 'decision',
    lines: ['Kas valitud kirjade', 'hulgas on veel mõni?'],
  },
  {
    id: 'finish',
    x: 380,
    y: 2055,
    kind: 'terminal',
    lines: [
      'Postkasti kontroll on lõppenud',
      'Salvesta kokkuvõte ja oota järgmist korda',
    ],
  },
  {
    id: 'web',
    x: 865,
    y: 1755,
    kind: 'store',
    lines: [
      'Kuulutused jõuavad veebitabelisse',
      'Uued andmed ilmuvad lehe värskendamisel',
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
  { path: 'M380 610 V660', label: 'Ei / pole teada', x: 270, y: 638 },
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
    path: 'M245 1905 H70 V715 H245',
    label: 'Jah: võta järgmine kiri',
    x: 155,
    y: 1878,
  },
  { path: 'M380 1960 V2019', label: 'Ei', x: 398, y: 1995 },
  { path: 'M1055 715 H1100 V1905 H515', dashed: true },
  { path: 'M1055 1155 H1100', dashed: true },
  { path: 'M1055 1325 H1100', dashed: true },
  {
    path: 'M570 1755 H675',
    label: 'Veebilehel',
    x: 615,
    y: 1740,
    dashed: true,
  },
];

export function WorkflowDiagram() {
  return (
    <section className="workflow-diagram-section">
      <h2>Protsessi vooskeem</h2>
      <p>
        Loe skeemi ülevalt alla. Iga küsimuse juures näitab „Jah” või „Ei”, kuhu
        edasi liikuda. Kõigepealt valitakse kirjad, seejärel vaadatakse need
        ükshaaval läbi. Ühes kirjas võib olla mitu kuulutust.
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
              Postkasti kontroll algab umbes kell 04 või 16 või käsitsi. Kui
              kontroll juba käib või seaded pole õiged, uut kontrolli ei
              alustata. Valitakse kuni 30 viimast saabunud kirja. Otse
              meililistidest ja uudiskirjadest saabunud kirjad lisatakse
              allikate statistikasse. Iga kirja puhul kontrollitakse, kas
              sellega on juba lõpetatud ja kas jätkamiseks on aega. Keelemudel
              otsib CFP-sid ja sündmusi. Seejärel kontrollitakse vastuse kuju,
              kuupäevi, kategooriaid ja linke. Kui kuulutusi ei leita,
              märgitakse kiri läbivaadatuks. Olemasolevaid kuulutusi
              täiendatakse ja uued lisatakse andmebaasi. Nii jätkatakse
              järgmiste kirjadega. Lõpus salvestatakse töö kokkuvõte. Tulemused
              ilmuvad veebilehe laadimisel või värskendamisel.
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
          Rombis on küsimus, kastis tegevus. Sinised kastid tähistavad
          salvestamist või veebis kuvamist. Paremal kulgev katkendjoon viib
          järgmise kirja juurde. Mobiilis saab skeemi külgsuunas kerida.
        </figcaption>
      </figure>
      <div className="info-note">
        <h3>Mida tasub skeemi kohta teada?</h3>
        <ul>
          <li>
            <strong>Millised kirjad lähevad arvesse?</strong> Allikate
            statistikas loetakse ainult otse meililistist või uudiskirjast
            saabunud kirju. Kuulutusi otsitakse ka edasisaadetud kirjadest.
          </li>
          <li>
            <strong>Millal jäetakse kiri vahele?</strong> Kui see on juba läbi
            vaadatud, ka siis, kui kuulutusi ei leitud. Samuti jäetakse vahele
            kiri, mille läbivaatamine on kolm korda ebaõnnestunud.
          </li>
          <li>
            <strong>Mida mudelilt oodatakse?</strong> Kuulutuse pealkiri ja
            kokkuvõte peavad jääma algkeelde, sealhulgas eesti keelde. Mudel
            valib ühe kuuest põhikategooriast ja täpsemad eestikeelsed
            teemasildid.
          </li>
          <li>
            <strong>Mida kontrollitakse automaatselt?</strong> Kas vastuses on
            nõutud andmed, kuupäevad on võimalikud, kategooriad lubatud ja
            lingid algses kirjas olemas. Need kontrollid ei taga, et mudel sai
            kuulutusest õigesti aru: üksikasju tuleb kontrollida korraldajalt.
          </li>
          <li>
            <strong>Kuidas kordusi välditakse?</strong> Iga leitud kuulutust
            võrreldakse olemasolevatega pealkirja, väljaandja, kuupäeva ja lingi
            järgi. Korduva kuulutuse juurde lisatakse uus allikaviide ja
            täidetakse puuduvad andmed. Tähtaega pikendatakse ainult siis, kui
            kirjas on selle kohta selge teade.
          </li>
          <li>
            <strong>Mis saab pooleli jäänud kirjast?</strong> Vea korral
            proovitakse seda hiljem uuesti, kokku kuni kolm korda. Kui
            käivituseks ette nähtud aeg saab otsa, töö peatub. Järgmisel
            käivitusel saab kiri uuesti kontrolli jõuda vaid siis, kui see on
            endiselt 30 viimase saabunud kirja hulgas.
          </li>
        </ul>
      </div>
    </section>
  );
}
