// username.js - the "pick a username" gate.
// Rules: letters and numbers only, at least 5 letters, at least 1 number. Obvious names are fine.
// validateUsername() is pure logic (no DOM) so it's easy to test; showUsername() is the form.

const USERNAME = { minLetters: 5, maxLen: 16, storeKey: "liamsGolfUser" };

function validateUsername(raw) {
  const name = raw.trim();
  const letterCount = (name.match(/[a-z]/gi) || []).length;
  const checks = {
    letters: letterCount >= USERNAME.minLetters,
    number: /\d/.test(name),
    clean: /^[a-z0-9]*$/i.test(name) && name.length <= USERNAME.maxLen,
  };
  return { name, letterCount, checks, ok: name.length > 0 && Object.values(checks).every(Boolean) };
}

// ---------- The form ----------
function rulesHtml(r) {
  const row = (ok, text) => `<div class="rule ${ok ? "ok" : "bad"}">[${ok ? "ok" : " "}] ${text}</div>`;
  return [
    row(r.checks.letters, `At least ${USERNAME.minLetters} letters (you have ${r.letterCount})`),
    row(r.checks.number, "At least 1 number"),
    r.name && !r.checks.clean ? row(false, `Letters and numbers only, up to ${USERNAME.maxLen} characters`) : "",
  ].join("");
}

function showUsername(onDone) {
  g.phase = "menu";
  g.onClub = null;
  overlay(`<h2>Pick your username</h2><p>5+ letters and 1+ number.</p>
    <input id="nameBox" class="nameBox" maxlength="${USERNAME.maxLen + 4}" autocomplete="off" spellcheck="false" placeholder="e.g. liam1">
    <div id="nameRules"></div>`);
  const box = $("nameBox");
  box.value = localStorage.getItem(USERNAME.storeKey) || "";
  button("Tee off", "", submit);
  const go = $("overlay").lastChild;

  function refresh() {
    const r = validateUsername(box.value);
    $("nameRules").innerHTML = rulesHtml(r);
    go.disabled = !r.ok;
    return r;
  }
  function submit() {
    const r = refresh();
    if (!r.ok) return;
    g.user = r.name;
    localStorage.setItem(USERNAME.storeKey, r.name);
    onDone();
  }
  box.addEventListener("input", refresh);
  box.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  refresh();
  box.focus();
}
