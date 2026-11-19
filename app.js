(() => {
  "use strict";
  const C = window.SHOP_CONFIG;
  const P = window.PRODUKTE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ONLINE = Boolean(C.supabaseUrl && C.supabaseAnonKey);

  // Schulnoten 1 bis 5 mit Smileys
  const NOTEN = [
    { n: 1, g: "😍", w: "sehr gut" },
    { n: 2, g: "🙂", w: "gut" },
    { n: 3, g: "😐", w: "geht so" },
    { n: 4, g: "🙁", w: "eher nicht" },
    { n: 5, g: "😖", w: "gar nicht" },
  ];

  // kleiner Speicher, der privates Surfen übersteht
  const lager = {
    lies(k, std) { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } },
    schreib(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } },
  };

  // ---------- Supabase über REST ----------
  async function api(pfad, opt = {}) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/${pfad}`, {
      ...opt,
      headers: { apikey: C.supabaseAnonKey, Authorization: `Bearer ${C.supabaseAnonKey}`, "Content-Type": "application/json", ...(opt.headers || {}) },
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

  // ---------- Kollektion ----------
  const held = P.find(p => p.id === "37") || P[0];
  $(".held-bild").src = held.rahmen;
  $(".held-bild").alt = held.titel;

  let filter = "alle", stil = null;
  function zeichneRaster() {
    const liste = P.filter(p => (filter === "alle" || p.linie === filter) && (!stil || p.stil === stil));
    $("#raster").innerHTML = "";
    for (const p of liste) {
      const s = schnitte[p.id];
      const b = document.createElement("button");
      b.className = "karte";
      b.innerHTML = `
        <div class="bildrahmen">
          <img class="rahmen" loading="lazy" alt="">
          <img class="motiv" loading="lazy" alt="">
        </div>
        <h3></h3>
        <div class="zeile"><span>${p.stil} · ${p.linie}</span><span>ab ${euro(ab)}</span></div>
        ${s ? `<div class="schnitt">Ø Note ${Number(s.schnitt).toFixed(1).replace(".", ",")} aus ${s.anzahl}</div>` : ""}`;
      $(".rahmen", b).src = p.rahmen;
      $(".motiv", b).src = p.motiv;
      $(".rahmen", b).alt = p.titel;
      $("h3", b).textContent = p.titel;
      b.addEventListener("click", () => oeffne(p));
      $("#raster").append(b);
    }
  }
  $$(".filter [data-filter]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    $$(".filter [data-filter]").forEach(x => x.classList.toggle("aktiv", x === b));
    zeichneRaster();
  }));
  $$(".filter [data-stil]").forEach(b => b.addEventListener("click", () => {
    stil = stil === b.dataset.stil ? null : b.dataset.stil;
    $$(".filter [data-stil]").forEach(x => x.classList.toggle("aktiv", x.dataset.stil === stil));
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
    $("#p-bewerten").onclick = () => { dlg.close(); zeige("bewerten"); springeZu(p.id); };
    dlg.showModal();
  }
  $$("#p-rahmenwahl button").forEach(b => b.addEventListener("click", () => {
    $$("#p-rahmenwahl button").forEach(x => x.classList.remove("aktiv")); b.classList.add("aktiv");
  }));
  $(".schliessen").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  // ---------- Bewerten ----------
  // Reihenfolge pro Person gemischt, damit nicht alle zuerst dieselben Bilder sehen
  let reihe = lager.lies("reihe", null);
  if (!reihe || reihe.length !== P.length || !reihe.every(id => P.some(p => p.id === id))) {
    reihe = P.map(p => p.id).sort(() => Math.random() - 0.5);
    lager.schreib("reihe", reihe);
  }
  const erledigt = new Set(lager.lies("erledigt", []));
  let pos = 0, gewaehlt = null, zeigtRahmen = true;
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
    b.addEventListener("click", () => waehle(x.n));
    notenBox.append(b);
  });
  function waehle(n) {
    gewaehlt = n;
    $$(".note").forEach((b, i) => b.setAttribute("aria-checked", String(i + 1 === n)));
    $("#senden").disabled = false;
  }

  function starteBewertung() {
    const offen = reihe.findIndex(id => !erledigt.has(id));
    pos = offen === -1 ? 0 : offen;
    zeigeKarte();
  }
  function springeZu(id) { pos = Math.max(0, reihe.indexOf(id)); zeigeKarte(); }

  function zeigeKarte() {
    const fertig = erledigt.size >= P.length && pos >= reihe.length;
    $("#karte").hidden = fertig;
    $("#fertig").hidden = !fertig;
    $("#balken").style.width = `${(erledigt.size / P.length) * 100}%`;
    $("#zaehler").textContent = `${erledigt.size} von ${P.length} bewertet`;
    if (fertig) return;
    const p = P.find(x => x.id === reihe[pos]);
    zeigtRahmen = true;
    $("#bew-img").src = p.rahmen;
    $("#bew-img").alt = p.titel;
    $("#bew-titel").textContent = p.titel;
    $("#bew-linie").textContent = `Motiv ${pos + 1} · ${p.linie} · ${p.stil}${erledigt.has(p.id) ? " · schon bewertet" : ""}`;
    $("#zeig-rahmen").classList.add("aktiv");
    $("#zeig-motiv").classList.remove("aktiv");
    $("#kommentar").value = "";
    $("#meldung").textContent = "";
    gewaehlt = null;
    $$(".note").forEach(b => b.setAttribute("aria-checked", "false"));
    $("#senden").disabled = true;
    $("#zurueck").disabled = pos === 0;
    // nächstes Bild vorladen
    const n = P.find(x => x.id === reihe[pos + 1]);
    if (n) new Image().src = n.rahmen;
  }
  $("#zeig-rahmen").addEventListener("click", () => { const p = P.find(x => x.id === reihe[pos]); $("#bew-img").src = p.rahmen; $("#zeig-rahmen").classList.add("aktiv"); $("#zeig-motiv").classList.remove("aktiv"); });
  $("#zeig-motiv").addEventListener("click", () => { const p = P.find(x => x.id === reihe[pos]); $("#bew-img").src = p.motiv; $("#zeig-motiv").classList.add("aktiv"); $("#zeig-rahmen").classList.remove("aktiv"); });

  function weiter() {
    pos += 1;
    if (pos >= reihe.length) {
      const offen = reihe.findIndex(id => !erledigt.has(id));
      if (offen !== -1) pos = offen;
    }
    zeigeKarte();
    $("#karte").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#ueberspringen").addEventListener("click", weiter);
  $("#zurueck").addEventListener("click", () => { pos = Math.max(0, pos - 1); zeigeKarte(); });

  $("#senden").addEventListener("click", async () => {
    if (!gewaehlt) return;
    const id = reihe[pos];
    $("#senden").disabled = true;
    $("#meldung").textContent = "Speichere …";
    try {
      await speichern({
        motiv_id: id,
        note: gewaehlt,
        kommentar: $("#kommentar").value.trim().slice(0, 1000) || null,
        name: name.value.trim().slice(0, 60) || null,
        geraet: matchMedia("(max-width: 760px)").matches ? "handy" : "computer",
      });
      erledigt.add(id);
      lager.schreib("erledigt", [...erledigt]);
      weiter();
    } catch (e) {
      console.error(e);
      $("#meldung").textContent = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
      $("#senden").disabled = false;
    }
  });
  document.addEventListener("keydown", e => {
    if ($("#bewerten").hidden || e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key >= "1" && e.key <= "5") waehle(Number(e.key));
    if (e.key === "Enter" && gewaehlt) $("#senden").click();
  });

  // ---------- Start ----------
  zeichneRaster();
  ladeSchnitte();
  const start = location.hash.slice(1);
  if (["bewerten", "ueber"].includes(start)) zeige(start);
})();
