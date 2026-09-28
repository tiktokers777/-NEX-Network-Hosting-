(() => {
  "use strict";
  const API = "api.php";
  const $ = (s, root=document) => root.querySelector(s);
  const prices = {
    "Corrección de errores pequeños":"$10.000 - $20.000 COP","Modificación de comandos":"$10.000 - $20.000 COP","Textos/mensajes":"$5.000 - $10.000 COP","Sistema pequeño":"$20.000 - $35.000 COP","Configuración":"$10.000 - $20.000 COP",
    "Sistema personalizado":"$40.000 - $70.000 COP","Sistema de diálogos":"$50.000 - $80.000 COP","Base de datos/MySQL":"$70.000 - $120.000 COP","Integración":"$60.000 - $100.000 COP","Optimización":"$40.000 - $80.000 COP","Bugs complejos":"$40.000 - $80.000 COP",
    "Sistema avanzado personalizado":"$100.000 - $180.000 COP","MySQL avanzado":"$130.000 - $220.000 COP","Sistema completo de servidor":"$180.000 - $350.000 COP","Modificaciones grandes de GameMode":"$150.000 - $300.000 COP","Funciones complejas":"$150.000 - $300.000 COP",
    "Mapeo básico":"$20.000 - $35.000 COP","Mapeo intermedio":"$40.000 - $80.000 COP","Mapeo avanzado":"$90.000 - $180.000 COP",
    "Mapeo + sistema básico":"$70.000 - $100.000 COP","Mapeo + sistema intermedio":"$120.000 - $180.000 COP","Mapeo + sistema avanzado":"$200.000 - $350.000+ COP",
    "Logo básico":"$15.000 - $25.000 COP","Logo personalizado":"$30.000 - $50.000 COP","Logo profesional":"$60.000 - $100.000 COP",
    "Paquete Starter":"Desde $80.000 COP","Paquete Pro":"Desde $180.000 COP","Paquete Full":"Desde $350.000 COP"
  };
  async function api(action, options={}) {
    const response = await fetch(`${API}?action=${encodeURIComponent(action)}${options.query ? "&"+options.query : ""}`, {
      method: options.method || "GET",
      headers: options.body ? {"Content-Type":"application/json"} : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials:"same-origin",
      cache:"no-store"
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { throw new Error(`El servidor no devolvió JSON válido (HTTP ${response.status}). ${raw.slice(0,240) || "Respuesta vacía"}`); }
    if (!response.ok || data.ok === false) throw new Error(data.message || `Error HTTP ${response.status}`);
    return data;
  }
  function feedback(el, message, type="") { if (!el) return; el.textContent=message; el.className=`feedback ${type}`.trim(); }
  const menu = $("#menuToggle"), nav=$("#mainNav");
  menu?.addEventListener("click",()=>nav.classList.toggle("open"));
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
  $("#year").textContent=new Date().getFullYear();
  const serviceSelect=$("#serviceSelect"), refPrice=$("#referencePrice");
  function updatePrice(){refPrice.textContent=prices[serviceSelect.value] || "Selecciona un servicio";}
  serviceSelect?.addEventListener("change",updatePrice);
  document.querySelectorAll("[data-prefill]").forEach(el=>el.addEventListener("click",()=>{
    const wanted=el.dataset.prefill;
    if(serviceSelect && [...serviceSelect.options].some(o=>o.value===wanted)) {serviceSelect.value=wanted;updatePrice();}
  }));
  $("#quoteForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget, btn=$("#submitBtn"), box=$("#quoteFeedback");
    const fd=new FormData(form), payload=Object.fromEntries(fd.entries());
    payload.cantidad=Number(payload.cantidad); payload.precio_referencia=prices[payload.servicio] || "Por definir";
    btn.disabled=true; btn.textContent="Enviando solicitud…"; feedback(box,"Enviando al servidor…");
    try {
      const data=await api("submit",{method:"POST",body:payload});
      feedback(box,`¡Cotización enviada correctamente!\nTu solicitud fue enviada correctamente.\nID de solicitud: ${data.id}\nGuarda este número para consultar el estado de tu cotización.`,"success");
      const result=document.createElement("div"); result.className="result-card";
      const title=document.createElement("h3"); title.textContent="¡Solicitud recibida!";
      const p=document.createElement("p"); p.textContent="Guarda este ID para consultar el estado desde cualquier dispositivo.";
      const id=document.createElement("div"); id.className="result-id"; id.textContent=data.id;
      const copy=document.createElement("button"); copy.className="btn btn-ghost"; copy.type="button"; copy.textContent="Copiar ID";
      copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(data.id);copy.textContent="ID copiado";}catch{copy.textContent=data.id;}});
      result.append(title,p,id,copy); box.append(result); form.reset(); updatePrice();
    } catch(err){feedback(box,err.message || "No se pudo enviar la cotización. Revisa la conexión y los permisos del servidor.","error");}
    finally{btn.disabled=false;btn.innerHTML='Enviar cotización <span>↗</span>';}
  });
  $("#lookupForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); const form=e.currentTarget, btn=$("#lookupBtn"), out=$("#lookupResult"), fd=new FormData(form);
    btn.disabled=true;btn.textContent="Consultando…";out.replaceChildren();
    try {
      const query=new URLSearchParams({id:String(fd.get("id")).trim(),correo:String(fd.get("correo")).trim()}).toString();
      const data=await api("get",{query});
      const q=data.cotizacion, card=document.createElement("article");card.className="result-card";
      const h=document.createElement("h3");h.textContent="Estado de tu cotización";
      const id=document.createElement("div");id.className="result-id";id.textContent=q.id;
      const grid=document.createElement("div");grid.className="result-grid";
      [["Servicio",q.servicio],["Estado",q.estado],["Precio final",q.precio_final||"Aún sin definir"],["Respuesta",q.respuesta||"Todavía no hay una respuesta del administrador."],["Fecha",q.fecha]].forEach(([k,v])=>{const d=document.createElement("div"),s=document.createElement("small"),b=document.createElement("strong");s.textContent=k;b.textContent=v;d.append(s,b);grid.append(d);});
      card.append(h,id,grid);out.append(card);
    }catch(err){const p=document.createElement("p");p.className="feedback error";p.textContent=err.message || "No se pudo consultar la cotización.";out.append(p);}
    finally{btn.disabled=false;btn.textContent="Consultar estado ↗";}
  });
})();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
