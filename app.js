(() => {
  "use strict";
  const C = window.SHOP_CONFIG;
  const P = window.PRODUKTE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ONLINE = Boolean(C.supabaseUrl && C.supabaseAnonKey);
  const GRUPPEN = ["Fotografie", "Illustration"];

  // Schulnoten 1 bis 5 mit Smileys
  const NOTEN = [
    { n: 1, g: "😍", w: "sehr gut" },
    { n: 2, g: "🙂", w: "gut" },
    { n: 3, g: "😐", w: "geht so" },
    { n: 4, g: "🙁", w: "eher nicht" },
    { n: 5, g: "😖", w: "gar nicht" },
  ];
  const komma = n => n.toFixed(1).replace(".", ",");

  // kleiner Speicher, der privates Surfen übersteht
  const lager = {
    lies(k, std) { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } },
    schreib(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } },
  };

  // ---------- Supabase über REST ----------
  // neue Schlüssel (sb_publishable_...) nur als apikey, alte JWT Schlüssel zusätzlich als Bearer
  const kopf = () => C.supabaseAnonKey.startsWith("eyJ")
    ? { apikey: C.supabaseAnonKey, Authorization: `Bearer ${C.supabaseAnonKey}` }
    : { apikey: C.supabaseAnonKey };
  async function api(pfad, opt = {}) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/${pfad}`, {
      ...opt,
      headers: { ...kopf(), "Content-Type": "application/json", ...(opt.headers || {}) },
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.status === 204 || r.status === 201 ? null : r.json();
  }
  async function speichern(eintrag) {
    if (!ONLINE) {
      const alle = lager.lies("bewertungen_lokal", []);
      alle.push({ ...eintrag, erstellt_am: new Date().toISOString() });
      lager.schreib("bewertungen_lokal", alle);
      return;
    }
    await api("bewertungen", { method: "POST", body: JSON.stringify(eintrag), headers: { Prefer: "return=minimal" } });
  }
  async function notenVon(id) {
    if (!ONLINE) return [];
    try { return (await api(`bewertungen?select=note&motiv_id=eq.${encodeURIComponent(id)}&limit=5000`)).map(r => r.note); }
    catch (e) { console.warn(e); return []; }
  }
  let schnitte = {};
  async function ladeSchnitte() {
    if (!ONLINE) return;
    try {
      const rows = await api("bewertung_uebersicht?select=motiv_id,anzahl,schnitt");
      schnitte = Object.fromEntries(rows.map(r => [r.motiv_id, r]));
      zeichneRaster();
    } catch (e) { console.warn("Übersicht nicht geladen", e); }
  }

  // ---------- Grundgerüst ----------
  $(".marke").textContent = C.marke;
  $(".marke-klein").textContent = C.marke;
  $(".untertitel").textContent = C.untertitel;
  $("#modus-info").textContent = ONLINE ? "" : "· Bewertungen werden vorerst nur in diesem Browser gespeichert";
  const ab = Math.min(...C.preise.map(p => p.preis));
  const euro = n => `${n} €`;

  function zeige(modus) {
    $$(".ansicht").forEach(v => (v.hidden = v.id !== modus));
    $$("nav button").forEach(b => b.classList.toggle("aktiv", b.dataset.modus === modus));
    if (modus === "bewerten") starteBewertung();
    history.replaceState(null, "", modus === "shop" ? location.pathname : `#${modus}`);
    window.scrollTo({ top: 0 });
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-modus]");
    if (b) { e.preventDefault(); $("#produkt").open && $("#produkt").close(); zeige(b.dataset.modus); }
  });

  // ---------- Kollektion, gruppiert nach Fotografie und Illustration ----------
  const held = P.find(p => p.id === "37") || P[0];
  $(".held-bild").src = held.rahmen;
  $(".held-bild").alt = held.titel;

  let filter = "alle";
  function karte(p) {
    const s = schnitte[p.id];
    const b = document.createElement("button");
    b.className = "karte";
    b.innerHTML = `
      <div class="bildrahmen">
        <img class="rahmen" loading="lazy" alt="">
        <img class="motiv" loading="lazy" alt="">
      </div>
      <h3></h3>
      <div class="zeile"><span>${p.linie}</span><span>ab ${euro(ab)}</span></div>
      ${s && erledigt.has(p.id) ? `<div class="schnitt">Ø Note ${komma(Number(s.schnitt))} aus ${s.anzahl} · deine Stimme ist dabei</div>` : ""}`;
    $(".rahmen", b).src = p.rahmen;
    $(".motiv", b).src = p.motiv;
    $(".rahmen", b).alt = p.titel;
    $("h3", b).textContent = p.titel;
    b.addEventListener("click", () => oeffne(p));
    return b;
  }
  function zeichneRaster() {
    const box = $("#raster");
    box.innerHTML = "";
    for (const g of GRUPPEN) {
      const liste = P.filter(p => p.stil === g && (filter === "alle" || p.linie === filter));
      if (!liste.length) continue;
      const kopf = document.createElement("div");
      kopf.className = "gruppe-kopf";
      kopf.innerHTML = `<h2>${g === "Fotografie" ? "Fotografie" : "Gezeichnet"}</h2><span>${g === "Fotografie" ? "Schwarzweiß, analog im Look" : "Gouache, Retro Illustration"} · ${liste.length} Motive</span>`;
      const raster = document.createElement("div");
      raster.className = "raster";
      liste.forEach(p => raster.append(karte(p)));
      box.append(kopf, raster);
    }
  }
  $$(".filter [data-filter]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    $$(".filter [data-filter]").forEach(x => x.classList.toggle("aktiv", x === b));
    zeichneRaster();
  }));

  // ---------- Produkt ----------
  const dlg = $("#produkt");
  function oeffne(p) {
    $("#p-titel").textContent = p.titel;
    $("#p-linie").textContent = `${p.linie} · ${p.stil}`;
    $("#p-bild").src = p.rahmen;
    $("#p-rahmen img").src = p.rahmen;
    $("#p-motiv img").src = p.motiv;
    $("#p-rahmen").onclick = () => ($("#p-bild").src = p.rahmen);
    $("#p-motiv").onclick = () => ($("#p-bild").src = p.motiv);
    const g = $("#p-groessen");
    g.innerHTML = "";
    C.preise.forEach((x, i) => {
      const b = document.createElement("button");
      b.textContent = x.groesse;
      b.className = i === 1 ? "aktiv" : "";
      b.onclick = () => { $$("button", g).forEach(y => y.classList.remove("aktiv")); b.classList.add("aktiv"); $("#p-preis").textContent = euro(x.preis); };
      g.append(b);
    });
    $("#p-preis").textContent = euro(C.preise[1].preis);
    $("#p-bewerten").onclick = () => { dlg.close(); zeige("bewerten"); };
    dlg.showModal();
  }
  $$("#p-rahmenwahl button").forEach(b => b.addEventListener("click", () => {
    $$("#p-rahmenwahl button").forEach(x => x.classList.remove("aktiv")); b.classList.add("aktiv");
  }));
  $(".schliessen").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  // ---------- Bewerten: ein Tipp, Animation, automatisch weiter ----------
  // Reihenfolge: erst alle Fotografien, dann alle Gezeichneten, innerhalb gemischt
  const mische = a => a.map(x => [Math.random(), x]).sort((u, v) => u[0] - v[0]).map(x => x[1]);
  let reihe = lager.lies("reihe2", null);
  if (!reihe || reihe.length !== P.length || !reihe.every(id => P.some(p => p.id === id))) {
    reihe = GRUPPEN.flatMap(g => mische(P.filter(p => p.stil === g).map(p => p.id)));
    lager.schreib("reihe2", reihe);
  }
  const erledigt = new Set(lager.lies("erledigt", []));
  let pos = 0, aktiv = null, vorab = null, sperre = false, weiterTimer = null, zeigtMotiv = false;
  const name = $("#name");
  name.value = lager.lies("name", "");
  name.addEventListener("change", () => lager.schreib("name", name.value.trim()));

  const notenBox = $(".noten");
  NOTEN.forEach(x => {
    const b = document.createElement("button");
    b.className = "note";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.setAttribute("aria-label", `Note ${x.n}, ${x.w}`);
    b.innerHTML = `<span class="gesicht">${x.g}</span><span class="zahl">${x.n}</span><span class="wort">${x.w}</span>`;
    b.addEventListener("click", () => abstimmen(x.n));
    notenBox.append(b);
  });

  function starteBewertung() {
    const offen = reihe.findIndex(id => !erledigt.has(id));
    pos = offen === -1 ? reihe.length : offen;
    zeigeKarte(false);
  }

  function fortschritt() {
    $("#balken").style.width = `${(erledigt.size / P.length) * 100}%`;
    const p = P.find(x => x.id === reihe[pos]);
    const gruppe = p ? (p.stil === "Fotografie" ? "Fotografie" : "Gezeichnet") : "";
    $("#zaehler").textContent = p ? `${gruppe} · ${erledigt.size + 1} von ${P.length}` : `${P.length} von ${P.length}`;
  }

  function zeigeKarte(mitUebergang) {
    const fertig = pos >= reihe.length;
    $("#karte").hidden = fertig;
    $("#fertig").hidden = !fertig;
    fortschritt();
    if (fertig) return;
    aktiv = P.find(x => x.id === reihe[pos]);
    const k = $("#karte");
    const fuellen = () => {
      zeigtMotiv = false;
      $("#bew-img").src = aktiv.rahmen;
      $("#bew-img").alt = aktiv.titel;
      $("#zeig-motiv").textContent = "Ohne Rahmen";
      $("#bew-titel").textContent = aktiv.titel;
      $("#bew-linie").textContent = aktiv.linie;
      $("#kommentar").value = "";
      $("#meldung").textContent = "";
      $("#ergebnis").classList.remove("sichtbar");
      $$(".note").forEach(b => { b.setAttribute("aria-checked", "false"); b.classList.remove("gedimmt"); });
      sperre = false;
    };
    // Noten der anderen schon jetzt holen, damit das Ergebnis sofort da ist
    vorab = notenVon(aktiv.id);
    const n = P.find(x => x.id === reihe[pos + 1]);
    if (n) new Image().src = n.rahmen;
    if (!mitUebergang) { fuellen(); return; }
    k.classList.add("raus");
    setTimeout(() => {
      fuellen();
      k.classList.remove("raus");
      k.classList.add("rein");
      requestAnimationFrame(() => requestAnimationFrame(() => k.classList.remove("rein")));
    }, 260);
  }

  $("#zeig-motiv").addEventListener("click", e => {
    e.stopPropagation();
    zeigtMotiv = !zeigtMotiv;
    $("#bew-img").src = zeigtMotiv ? aktiv.motiv : aktiv.rahmen;
    $("#zeig-motiv").textContent = zeigtMotiv ? "Im Rahmen" : "Ohne Rahmen";
  });

  async function abstimmen(note) {
    if (sperre || !aktiv) return;
    sperre = true;
    const id = aktiv.id;
    $$(".note").forEach((b, i) => {
      b.setAttribute("aria-checked", String(i + 1 === note));
      b.classList.toggle("gedimmt", i + 1 !== note);
    });
    const eintrag = {
      motiv_id: id,
      note,
      kommentar: $("#kommentar").value.trim().slice(0, 1000) || null,
      name: name.value.trim().slice(0, 60) || null,
      geraet: matchMedia("(max-width: 760px)").matches ? "handy" : "computer",
    };
    // speichern und Ergebnis zeigen laufen gleichzeitig
    const gespeichert = speichern(eintrag).then(() => true, e => { console.error(e); return false; });
    const andere = await vorab;
    zeigeErgebnis(note, andere);
    if (!(await gespeichert)) {
      $("#meldung").textContent = "Speichern hat nicht geklappt, die Note wird gleich nochmal gesendet.";
      try { await speichern(eintrag); $("#meldung").textContent = ""; } catch { $("#meldung").textContent = "Keine Verbindung. Bitte später nochmal versuchen."; sperre = false; return; }
    }
    erledigt.add(id);
    lager.schreib("erledigt", [...erledigt]);
    clearTimeout(weiterTimer);
    weiterTimer = setTimeout(naechstes, 2200);
  }

  // Animation: Skala 1 bis 5 mit deinem Punkt und dem Schnitt der anderen, dazu Balken
  function zeigeErgebnis(meine, andere) {
    const links = n => `${((n - 1) / 4) * 100}%`;
    const du = $("#marke-du"), ma = $("#marke-andere");
    du.style.left = links(meine);
    du.querySelector("span").textContent = `Du ${NOTEN[meine - 1].g}`;
    const max = Math.max(...NOTEN.map(x => andere.filter(n => n === x.n).length), 1);
    if (andere.length) {
      const schnitt = andere.reduce((a, b) => a + b, 0) / andere.length;
      ma.hidden = false;
      ma.style.transition = "none";
      ma.style.left = links(meine);           // startet bei dir und gleitet zum Schnitt
      $("#andere-label").textContent = `Ø andere ${komma(schnitt)}`;
      const diff = Math.abs(schnitt - meine);
      $("#erg-text").textContent = diff < 0.5 ? "Du liegst genau im Trend." : schnitt < meine ? "Den anderen gefällt es besser als dir." : "Dir gefällt es besser als den anderen.";
      $("#erg-text").append(Object.assign(document.createElement("span"), { className: "klein-text", textContent: ` ${andere.length} ${andere.length === 1 ? "Stimme" : "Stimmen"}` }));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ma.style.transition = "";
        ma.style.left = links(schnitt);
      }));
    } else {
      ma.hidden = true;
      $("#erg-text").textContent = ONLINE ? "Du bist die erste Stimme für dieses Motiv." : "Der Vergleich erscheint, sobald Bewertungen online gespeichert werden.";
    }
    $("#erg-balken").innerHTML = NOTEN.map(x => {
      const c = andere.filter(n => n === x.n).length;
      return `<div class="erg-zeile${x.n === meine ? " meine" : ""}"><span>${x.g}</span><div class="erg-spur"><div data-w="${(c / max) * 100}"></div></div><span>${c}</span></div>`;
    }).join("");
    $("#ergebnis").classList.add("sichtbar");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$("#erg-balken [data-w]").forEach((el, i) => { el.style.transitionDelay = `${i * 60}ms`; el.style.width = `${el.dataset.w}%`; });
    }));
  }

  function naechstes() {
    clearTimeout(weiterTimer);
    if (!$("#ergebnis").classList.contains("sichtbar")) return;
    pos += 1;
    if (pos >= reihe.length) {
      const offen = reihe.findIndex(id => !erledigt.has(id));
      pos = offen === -1 ? reihe.length : offen;
    }
    ladeSchnitte();
    zeigeKarte(true);
  }
  // Tippen auf das Ergebnis geht sofort weiter
  $("#ergebnis").addEventListener("click", naechstes);

  document.addEventListener("keydown", e => {
    if ($("#bewerten").hidden || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ($("#ergebnis").classList.contains("sichtbar")) { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); naechstes(); } return; }
    if (e.key >= "1" && e.key <= "5") abstimmen(Number(e.key));
  });
  // im Kommentarfeld: Enter springt zu den Noten
  $("#kommentar").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } });

  // ---------- Start ----------
  zeichneRaster();
  ladeSchnitte();
  const start = location.hash.slice(1);
  if (["bewerten", "ueber"].includes(start)) zeige(start);
})();
