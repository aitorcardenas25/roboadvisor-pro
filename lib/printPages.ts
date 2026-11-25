// lib/printPages.ts
// Impressió / «Desar en PDF» dels informes HTML (informe bursàtil, informe manual).
//
// Cada <div class="page"> fa 880 px d'ample i com a mínim 1180 px d'alt. En imprimir-los
// en A4 el navegador partia les pàgines que no hi cabien i deixava fulls gairebé buits
// (un tros de taula o una línia sola). Aquí:
//  · el full fa 880 × 1244 px (proporció A4 exacta) i sense marges, perquè una .page
//    ompli un full;
//  · abans d'imprimir, una pàgina una mica més alta que el full (fins a un 35 % més)
//    s'encongeix per cabre-hi sencera en lloc de deixar un full gairebé buit;
//  · les més llargues continuen al full següent, com abans.

/** Alçada d'un full A4 quan l'amplada és 880 px (880 × 297 / 210). */
export const PRINT_PAGE_HEIGHT = 1244;

export const PRINT_PAGE_CSS = `
  @page{size:880px ${PRINT_PAGE_HEIGHT}px;margin:0}
  @media print{
    html,body{background:#fff}
    .page{margin:0 !important;box-shadow:none !important;min-height:${PRINT_PAGE_HEIGHT}px;break-after:page;page-break-after:always}
    .page:last-of-type{break-after:auto;page-break-after:auto}
  }
`;

export const PRINT_FIT_SCRIPT = `<script>(function(){
  var H=${PRINT_PAGE_HEIGHT},MAX=1.35;
  function pages(){return Array.prototype.slice.call(document.querySelectorAll('.page'));}
  function reset(){pages().forEach(function(p){p.style.zoom='';});}
  function fit(){reset();pages().forEach(function(p){var h=p.scrollHeight;if(h>H&&h<=H*MAX){p.style.zoom=String(Math.floor(H/h*1000)/1000);}});}
  window.addEventListener('beforeprint',fit);
  window.addEventListener('afterprint',reset);
  if(window.matchMedia){var m=window.matchMedia('print');var f=function(e){if(e.matches)fit();else reset();};if(m.addEventListener)m.addEventListener('change',f);else if(m.addListener)m.addListener(f);}
})();</script>`;
