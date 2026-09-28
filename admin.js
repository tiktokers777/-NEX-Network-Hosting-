(() => {
"use strict";
const API="api.php", $=(s,r=document)=>r.querySelector(s);
let quotes=[], knownIds=new Set(), initialized=false, pollTimer=null, csrf="";
async function api(action, options={}) {
 const response=await fetch(`${API}?action=${encodeURIComponent(action)}${options.query?"&"+options.query:""}`,{method:options.method||"GET",headers:options.body?{"Content-Type":"application/json"}:{},body:options.body?JSON.stringify(options.body):undefined,credentials:"same-origin",cache:"no-store"});
 const raw=await response.text();let data;
 try{data=JSON.parse(raw);}catch{throw new Error(`Respuesta no válida del servidor (HTTP ${response.status}): ${raw.slice(0,220)||"vacía"}`);}
 if(!response.ok||data.ok===false)throw new Error(data.message||`Error HTTP ${response.status}`);
 return data;
}
function msg(el,text,type=""){el.textContent=text;el.className=`feedback ${type}`.trim();}
function safeText(tag,text,cls){const n=document.createElement(tag);n.textContent=text??"";if(cls)n.className=cls;return n;}
function escCsv(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
function render(){
 const list=$("#quotesList"), filter=$("#statusFilter").value, term=$("#searchInput").value.trim().toLowerCase();
 list.replaceChildren();
 const shown=quotes.filter(q=>(!filter||q.estado===filter)&&(!term||[q.id,q.nombre,q.correo,q.servicio].some(x=>String(x||"").toLowerCase().includes(term))));
 $("#totalCount").textContent=quotes.length;
 $("#pendingCount").textContent=quotes.filter(q=>q.estado==="Pendiente").length;
 $("#approvedCount").textContent=quotes.filter(q=>q.estado==="Aprobada").length;
 $("#rejectedCount").textContent=quotes.filter(q=>q.estado==="Rechazada").length;
 if(!shown.length){list.append(safeText("div",quotes.length?"No hay cotizaciones que coincidan con el filtro.":"Aún no se han recibido cotizaciones.","empty-state"));return;}
 shown.forEach(q=>{
  const card=document.createElement("article");card.className="quote-card";
  const top=document.createElement("div");top.className="quote-card-top";
  const left=document.createElement("div");left.append(safeText("div",q.id,"quote-id"),safeText("h3",q.nombre),safeText("div",q.correo,"feedback"));
  const status=safeText("span",q.estado,`status ${String(q.estado).toLowerCase()}`);top.append(left,status);card.append(top);
  const details=document.createElement("div");details.className="quote-details";
  [["Servicio",q.servicio],["Cantidad",q.cantidad],["Referencia",q.precio_referencia],["Precio final",q.precio_final||"Sin definir"],["Fecha",q.fecha]].forEach(([k,v])=>{const d=document.createElement("div");d.append(safeText("small",k),safeText("span",v));details.append(d);});card.append(details);
  card.append(safeText("div",q.descripcion,"quote-description"));
  if(q.respuesta)card.append(safeText("p",`Respuesta: ${q.respuesta}`,"feedback"));
  const actions=document.createElement("div");actions.className="quote-actions";
  const edit=document.createElement("button");edit.className="btn btn-primary";edit.textContent="Editar / responder";edit.addEventListener("click",()=>openEdit(q));
  const mail=document.createElement("a");mail.className="btn btn-ghost";mail.textContent="Contactar por correo";mail.href=`mailto:${encodeURIComponent(q.correo)}?subject=${encodeURIComponent("Respuesta a tu cotización "+q.id)}`;
  const del=document.createElement("button");del.className="btn btn-danger";del.textContent="Eliminar";del.addEventListener("click",()=>deleteOne(q.id));
  actions.append(edit,mail,del);card.append(actions);list.append(card);
 });
}
async function loadQuotes(notify=true){
 const data=await api("list");const incoming=data.cotizaciones||[];
 if(notify&&initialized){const fresh=incoming.filter(q=>!knownIds.has(q.id));if(fresh.length){showToast("¡Nueva cotización recibida!");if("Notification"in window&&Notification.permission==="granted")new Notification("SGT San Andrés",{body:`Nueva solicitud: ${fresh[0].id} · ${fresh[0].nombre}`});}}
 quotes=incoming;knownIds=new Set(incoming.map(q=>q.id));initialized=true;render();msg($("#adminFeedback"),`Actualizado: ${new Date().toLocaleTimeString()}`,"success");
}
function showToast(text,error=false){const t=safeText("div",text,`toast${error?" error":""}`);document.body.append(t);setTimeout(()=>t.remove(),4200);}
function openEdit(q){
 const modal=$("#editModal"),f=$("#editForm");f.elements.id.value=q.id;f.elements.estado.value=q.estado;f.elements.precio_final.value=q.precio_final||"";f.elements.respuesta.value=q.respuesta||"";
 $("#editTitle").textContent="Editar cotización";$("#editMeta").replaceChildren(safeText("div",`${q.id} · ${q.nombre}`),safeText("div",q.servicio),safeText("div",q.correo));
 msg($("#editFeedback"),"");modal.hidden=false;
}
function closeModal(){$("#editModal").hidden=true;}
async function deleteOne(id){if(!confirm(`¿Eliminar la cotización ${id}? Esta acción no se puede deshacer.`))return;try{await api("delete",{method:"POST",body:{id,csrf}});await loadQuotes(false);showToast("Cotización eliminada.");}catch(e){showToast(e.message,true);}}
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#loginBtn"),password=e.currentTarget.elements.password.value;btn.disabled=true;msg($("#loginFeedback"),"Verificando acceso…");
 try{const d=await api("login",{method:"POST",body:{password}});csrf=d.csrf||"";$("#loginSection").hidden=true;$("#dashboardSection").hidden=false;
 if("Notification"in window&&Notification.permission==="default"){try{await Notification.requestPermission();}catch{}}
 await loadQuotes(false);pollTimer=setInterval(()=>loadQuotes(true).catch(err=>msg($("#adminFeedback"),err.message,"error")),3000);
 }catch(err){msg($("#loginFeedback"),err.message,"error");}finally{btn.disabled=false;e.currentTarget.elements.password.value="";}
});
$("#refreshBtn").addEventListener("click",()=>loadQuotes(false).catch(e=>msg($("#adminFeedback"),e.message,"error")));
$("#statusFilter").addEventListener("change",render);$("#searchInput").addEventListener("input",render);
$("#logoutBtn").addEventListener("click",async()=>{try{await api("logout",{method:"POST",body:{csrf}});}catch{}if(pollTimer)clearInterval(pollTimer);$("#dashboardSection").hidden=true;$("#loginSection").hidden=false;csrf="";});
$("#editForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,btn=$("#saveEditBtn");btn.disabled=true;msg($("#editFeedback"),"Guardando cambios…");
 try{await api("update",{method:"POST",body:{id:f.elements.id.value,estado:f.elements.estado.value,precio_final:f.elements.precio_final.value.trim(),respuesta:f.elements.respuesta.value.trim(),csrf}});closeModal();await loadQuotes(false);showToast("Cambios guardados correctamente.");}
 catch(err){msg($("#editFeedback"),err.message,"error");}finally{btn.disabled=false;}
});
$("#closeModal").addEventListener("click",closeModal);$("#cancelEdit").addEventListener("click",closeModal);$("#editModal").querySelector(".modal-backdrop").addEventListener("click",closeModal);
$("#deleteAllBtn").addEventListener("click",async()=>{if(!quotes.length)return showToast("No hay cotizaciones para eliminar.",true);if(!confirm("¿Eliminar TODAS las cotizaciones? Esta acción es irreversible."))return;if(!confirm("Confirma por segunda vez: se borrarán todas las solicitudes."))return;try{await api("delete_all",{method:"POST",body:{csrf}});await loadQuotes(false);showToast("Todas las cotizaciones fueron eliminadas.");}catch(e){showToast(e.message,true);}});
$("#exportBtn").addEventListener("click",()=>{const cols=["id","nombre","correo","servicio","cantidad","precio_referencia","precio_final","descripcion","estado","respuesta","fecha"];const rows=[cols.join(","),...quotes.map(q=>cols.map(k=>escCsv(q[k])).join(","))];const blob=new Blob(["\uFEFF"+rows.join("\r\n")],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sgt-cotizaciones.csv";a.click();URL.revokeObjectURL(url);});
})();