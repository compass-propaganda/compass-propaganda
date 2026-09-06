// SPDX-License-Identifier: MIT
const setup = document.querySelector("[data-oracle-setup]");
const tablist = setup.querySelector(".oracle-tabs");
const tabs = [...tablist.querySelectorAll("a")];
const panels = [...setup.querySelectorAll(".oracle-panel")];

function selectTab(tab) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = `#${panel.id}` !== tab.hash;
}

tablist.setAttribute("role", "tablist");
for (const tab of tabs) {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", tab.hash.slice(1));
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    selectTab(tab);
    history.replaceState(null, "", tab.hash);
  });
  tab.addEventListener("keydown", (event) => {
    let index = tabs.indexOf(tab);
    if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else if (event.key !== " ") return;
    event.preventDefault();
    tabs[index].focus();
    tabs[index].click();
  });
}
for (const panel of panels) {
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `tab-${panel.id}`);
  panel.tabIndex = 0;
}
const selectFromHash = () =>
  selectTab(tabs.find((tab) => tab.hash === location.hash) || tabs[0]);
selectFromHash();
window.addEventListener("hashchange", selectFromHash);
