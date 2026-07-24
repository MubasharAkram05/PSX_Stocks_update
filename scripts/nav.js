// scripts/nav.js
// Shared "Calculators" dropdown toggle — used on every page.

document.querySelectorAll('.dropdown > .dropbtn').forEach((b) => {
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.parentElement.classList.toggle('open');
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
});
