import { useEffect, useRef } from 'react';

export type InfoPageKind = 'sources' | 'architecture';
const mailbox = 'callsevents208@gmail.com';

export function InfoPage({ kind }: { kind: InfoPageKind }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const title =
    kind === 'sources'
      ? 'Lisa uus allikas, mida jälgida'
      : 'CFP rakenduse arhitektuur';
  useEffect(() => {
    document.title = `${title} · CFP & Events Tracker`;
    heading.current?.focus();
    window.scrollTo(0, 0);
    return () => {
      document.title = 'CFP & Events Tracker';
    };
  }, [title]);
  return (
    <article className="info-page">
      <a className="back-link" href="#/">
        ← Tagasi kuulutuste juurde
      </a>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {kind === 'sources' ? (
        <>
          <p className="info-lead">
            Aita tuua Call for Papers (CFP) ja teadusürituste teated ühte kohta.
            Selleks saad tellida ühisesse postkasti uudiskirju või saata sinna
            huvipakkuva kirja edasi.
          </p>
          <div className="mailbox-panel">
            <span>Rakenduse jälgitav postkast</span>
            <a href={`mailto:${mailbox}`}>{mailbox}</a>
          </div>
          <section>
            <h2>1. Lisa uus meililist või uudiskiri</h2>
            <ol>
              <li>
                Ava ajakirja, ülikooli või uurimisrühma veebileht ning leia
                meililisti või uudiskirja tellimise vorm.
              </li>
              <li>
                Sisesta tellimuse e-posti aadressiks <strong>{mailbox}</strong>.
              </li>
              <li>
                Kui tellimus vajab e-kirjaga kinnitamist, palu postkasti
                halduril kinnituskiri avada ja tellimus kinnitada. Importija
                tellimusi ise ei kinnita.
              </li>
            </ol>
            <p>
              Edaspidi jõuavad selle allika kirjad ühisesse postkasti. Importija
              otsib neist CFP-sid ja teadusüritusi ning lisab leitud kuulutused
              tabelisse automaatselt.
            </p>
          </section>
          <section>
            <h2>2. Saada oma postkastist kiri edasi</h2>
            <p>
              Kui saad huvitava CFP, konverentsi, seminari või töötoa teate,
              vali oma postkastis <strong>„Saada edasi”</strong> ja määra
              saajaks <strong>{mailbox}</strong>. Jäta kirja sisse kuulutuse
              tekst, kuupäevad ja algallika lingid.
            </p>
            <p>
              Edastatud kiri läbib sama automaatse töötluse nagu uudiskiri.
              Mudel tuvastab kirja tekstist kuulutused ja nende põhiandmed.
              Ühest kirjast võib tabelisse lisanduda mitu kuulutust; korduvaid
              kuulutusi püütakse ühendada.
            </p>
            <p>
              Edasta kuulutuse tekst kirja sisus: importija ei loe manuseid.
              Rakendusse sisselogimine ei ole kirja edasisaatmiseks vajalik.
            </p>
          </section>
          <section className="info-note">
            <h2>Millal kuulutus tabelisse jõuab?</h2>
            <p>
              Automaatika on seadistatud kontrollima postkasti iga päev umbes
              kell <strong>04:00 ja 16:00 Tallinna aja järgi</strong>. Igal
              korral vaadatakse kuni 30 viimast saabunud kirja; juba töödeldud
              kirju uuesti ei analüüsita.
            </p>
            <p>
              Kui kahe kontrolli vahel saabub üle 30 kirja, võivad vanemad
              sellest kontrollist välja jääda. Kui kirjast sobivat CFP-d või
              teadusüritust ei leita, tabelisse uut rida ei teki.
            </p>
            <p>
              Kirja tekst saadetakse OpenAI-le andmete tuvastamiseks. Edasta
              avaldamiseks sobivaid teateid; kontrolli kuupäevi ja tingimusi
              alati algallikast.
            </p>
          </section>
        </>
      ) : (
        <>
          <p className="info-lead">
            CFP &amp; Events Tracker koondab e-kirjades avaldatud Call for
            Papers (CFP) ja teadusüritused otsitavasse tabelisse. Veebileht
            kuvab andmeid; kirjade lugemine ja mudeli töö käivad taustal.
          </p>
          <section>
            <h2>Teekond kirjast kuulutuseni</h2>
            <ol className="workflow">
              <li>
                <strong>Gmail</strong>
                <span>
                  Uudiskirjad, meililistid ja edasisaadetud teated jõuavad
                  ühisesse postkasti.
                </span>
              </li>
              <li>
                <strong>Google Apps Script</strong>
                <span>
                  Ajastatud importija valib kuni 30 viimast saabunud kirja ning
                  jätab juba töödeldud kirjad vahele.
                </span>
              </li>
              <li>
                <strong>OpenAI</strong>
                <span>
                  Mudel leiab kirja tekstist CFP-d ja üritused ning eraldab
                  pealkirja, kuupäevad, korraldaja, lingid ja muud põhiandmed.
                </span>
              </li>
              <li>
                <strong>Kontroll ja ühendamine</strong>
                <span>
                  Importija kontrollib mudeli vastuse vormingut ja kuupäevi,
                  võrdleb leide olemasolevate kuulutustega ning ühendab
                  kordused.
                </span>
              </li>
              <li>
                <strong>Supabase</strong>
                <span>
                  Andmebaasi salvestatakse kuulutused, nende allikaviited ja
                  töötluse olek, et samu kirju ei peaks uuesti analüüsima.
                </span>
              </li>
              <li>
                <strong>Veebirakendus</strong>
                <span>
                  Reactiga loodud kasutajaliides loeb Supabase’ist kuulutused
                  ning kuvab need filtrite, kuupäevade ja päevade loenduriga
                  tabelis.
                </span>
              </li>
            </ol>
          </section>
          <section>
            <h2>Millised tehnoloogiad mida teevad?</h2>
            <dl className="technology-list">
              <div>
                <dt>React, TypeScript ja Vite</dt>
                <dd>Kasutajaliides ning veebirakenduse koostamine.</dd>
              </div>
              <div>
                <dt>GitHub Pages</dt>
                <dd>
                  Avaliku veebilehe majutus. GitHub Actions avaldab
                  koodiuuendustest uue versiooni.
                </dd>
              </div>
              <div>
                <dt>Google Apps Script ja Gmail</dt>
                <dd>
                  Postkasti lugemine, ajastus ja kogu importimise töövoo
                  juhtimine.
                </dd>
              </div>
              <div>
                <dt>OpenAI API</dt>
                <dd>Kirjateksti analüüs ja kuulutuste andmete tuvastamine.</dd>
              </div>
              <div>
                <dt>Supabase / PostgreSQL</dt>
                <dd>
                  Andmete säilitamine, haldurite sisselogimine ja
                  ligipääsuõigused.
                </dd>
              </div>
            </dl>
          </section>
          <section className="info-note">
            <h2>Automaatika ja haldurid</h2>
            <p>
              Taustatöö toimub umbes kell 04:00 ja 16:00 Tallinna aja järgi ka
              siis, kui keegi veebilehte ei vaata. Uued tulemused ilmuvad
              tabelisse lehe laadimisel või värskendamisel.
            </p>
            <p>
              Külastajad saavad kuulutusi sirvida ja filtreerida. Sisseloginud
              haldurid saavad neid lisada, parandada, arhiveerida ning vaadata
              allikate infot.
            </p>
            <p>
              OpenAI ja andmebaasi salajased võtmed asuvad taustaskripti
              seadetes. Avalik veebileht ei vaja neid võtmeid. Kirjade
              täistekste andmebaasi ei salvestata; allikaviited ja töötlusandmed
              on nähtavad ainult halduritele.
            </p>
          </section>
        </>
      )}
    </article>
  );
}
