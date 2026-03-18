// ══════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn,i)=>{
    btn.classList.toggle('active',(i===0&&tab==='sketch')||(i===1&&tab==='stl'));
  });
  document.getElementById('tab-sketch').classList.toggle('active',tab==='sketch');
  document.getElementById('tab-stl').classList.toggle('active',tab==='stl');
  if (tab==='stl'&&!stlRendererInitialised) initSTLViewer();
}

// ══════════════════════════════════════
// SLIDERS
// ══════════════════════════════════════
const units={noselen:'mm',bodylen:'mm',diameter:'mm',nfins:'',finspan:'mm',finroot:'mm',fintip:'mm',mass:'g',cd:''};

function updateSlider(name) {
  const val=document.getElementById('sl-'+name).value;
  const unit=units[name]||'';
  document.getElementById('val-'+name).textContent=val+(unit?' '+unit:'');
  drawRocket();
}

function getVal(name) { return parseFloat(document.getElementById('sl-'+name).value); }

// ══════════════════════════════════════
// SVG ROCKET DRAWING
// ══════════════════════════════════════
function drawRocket() {
  const svg      = document.getElementById('rocketSVG');
  const noselen  = getVal('noselen');
  const bodylen  = getVal('bodylen');
  const diameter = getVal('diameter');
  const finspan  = getVal('finspan');
  const finroot  = getVal('finroot');
  const fintip   = getVal('fintip');
  const nfins    = getVal('nfins');
  const shape    = document.getElementById('noseShape').value;
  const totalLen = noselen+bodylen;

  document.getElementById('stat-length').textContent   = totalLen+' mm';
  document.getElementById('stat-diameter').textContent  = diameter+' mm';
  document.getElementById('stat-finspan').textContent   = finspan+' mm';

  const svgW=300,svgH=500,pad=40;
  const scale    = (svgH-pad*2)/totalLen;
  const sNose    = noselen*scale;
  const sBody    = bodylen*scale;
  const sDiam    = Math.min(diameter*scale*2.5,svgW*0.34);
  const sFSpan   = finspan*scale;
  const sFRoot   = finroot*scale;
  const sFTip    = fintip*scale;
  const cx=svgW/2, topY=pad, bodyTopY=topY+sNose, bodyBotY=bodyTopY+sBody, halfW=sDiam/2;

  let paths='';

  // Nose cone
  let nosePath='';
  if (shape==='conical') {
    nosePath=`M ${cx} ${topY} L ${cx+halfW} ${bodyTopY} L ${cx-halfW} ${bodyTopY} Z`;
  } else if (shape==='ogive') {
    nosePath=`M ${cx} ${topY} C ${cx+halfW*0.15} ${topY+sNose*0.3},${cx+halfW} ${bodyTopY-sNose*0.3},${cx+halfW} ${bodyTopY} L ${cx-halfW} ${bodyTopY} C ${cx-halfW} ${bodyTopY-sNose*0.3},${cx-halfW*0.15} ${topY+sNose*0.3},${cx} ${topY} Z`;
  } else {
    nosePath=`M ${cx} ${topY} Q ${cx+halfW*0.8} ${topY+sNose*0.6},${cx+halfW} ${bodyTopY} L ${cx-halfW} ${bodyTopY} Q ${cx-halfW*0.8} ${topY+sNose*0.6},${cx} ${topY} Z`;
  }
  paths+=`<path d="${nosePath}" fill="#ff4d1c" stroke="#ff7043" stroke-width="1"/>`;

  // Body
  paths+=`<rect x="${cx-halfW}" y="${bodyTopY}" width="${sDiam}" height="${sBody}" fill="url(#bodyGrad)" stroke="#ff4d1c" stroke-width="1"/>`;

  // Window
  const winR=Math.max(halfW*0.25,4);
  paths+=`<circle cx="${cx}" cy="${bodyTopY+sBody*0.2}" r="${winR}" fill="rgba(100,185,255,0.3)" stroke="rgba(100,185,255,0.6)" stroke-width="1"/>`;

  // Fins
  const finTopY=bodyBotY-sFRoot, offset=(sFRoot-sFTip)/2;
  paths+=`<polygon points="${cx+halfW},${finTopY} ${cx+halfW+sFSpan},${finTopY+offset} ${cx+halfW+sFSpan},${bodyBotY-offset} ${cx+halfW},${bodyBotY}" fill="#b03008" stroke="#ff4d1c" stroke-width="1"/>`;
  paths+=`<polygon points="${cx-halfW},${finTopY} ${cx-halfW-sFSpan},${finTopY+offset} ${cx-halfW-sFSpan},${bodyBotY-offset} ${cx-halfW},${bodyBotY}" fill="#b03008" stroke="#ff4d1c" stroke-width="1"/>`;
  if (nfins>=4) {
    paths+=`<polygon points="${cx-halfW*0.5},${bodyBotY-sFRoot} ${cx},${bodyBotY-sFRoot-sFSpan*0.6} ${cx},${bodyBotY-sFRoot-sFSpan*0.6+sFTip} ${cx+halfW*0.5},${bodyBotY-sFRoot}" fill="#8a2006" stroke="#ff4d1c" stroke-width="0.5" opacity="0.7"/>`;
  }

  // Nozzle + flame
  const nW=halfW*0.5, nH=sBody*0.06, fH=sBody*0.12;
  paths+=`<rect x="${cx-nW}" y="${bodyBotY}" width="${nW*2}" height="${nH}" fill="#1a1a1a" stroke="#333" stroke-width="1" rx="2"/>`;
  paths+=`<ellipse cx="${cx}" cy="${bodyBotY+nH+fH*0.4}" rx="${nW*0.7}" ry="${fH*0.5}" fill="#ff8800" opacity="0.9"><animate attributeName="ry" values="${fH*0.4};${fH*0.62};${fH*0.4}" dur="0.4s" repeatCount="indefinite"/></ellipse>`;
  paths+=`<ellipse cx="${cx}" cy="${bodyBotY+nH+fH*0.28}" rx="${nW*0.4}" ry="${fH*0.35}" fill="#ffcc00" opacity="0.95"><animate attributeName="ry" values="${fH*0.28};${fH*0.44};${fH*0.28}" dur="0.3s" repeatCount="indefinite"/></ellipse>`;

  // Dimension lines
  const dc='#2a2a42',dt='#6e6e8a',df=9;
  const dlx=cx+halfW+sFSpan+18;
  paths+=`<line x1="${dlx}" y1="${topY}" x2="${dlx}" y2="${bodyBotY}" stroke="${dc}" stroke-width="0.8"/>
    <line x1="${dlx-4}" y1="${topY}" x2="${dlx+4}" y2="${topY}" stroke="${dc}" stroke-width="0.8"/>
    <line x1="${dlx-4}" y1="${bodyBotY}" x2="${dlx+4}" y2="${bodyBotY}" stroke="${dc}" stroke-width="0.8"/>
    <text x="${dlx+6}" y="${(topY+bodyBotY)/2}" fill="${dt}" font-size="${df}" dominant-baseline="middle">${totalLen}mm</text>`;
  paths+=`<line x1="${cx-halfW}" y1="${bodyTopY-8}" x2="${cx+halfW}" y2="${bodyTopY-8}" stroke="${dc}" stroke-width="0.8"/>
    <line x1="${cx-halfW}" y1="${bodyTopY-12}" x2="${cx-halfW}" y2="${bodyTopY-4}" stroke="${dc}" stroke-width="0.8"/>
    <line x1="${cx+halfW}" y1="${bodyTopY-12}" x2="${cx+halfW}" y2="${bodyTopY-4}" stroke="${dc}" stroke-width="0.8"/>
    <text x="${cx}" y="${bodyTopY-14}" fill="${dt}" font-size="${df}" text-anchor="middle">⌀${diameter}mm</text>`;

  const defs=`<defs><linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#b03008"/><stop offset="40%" stop-color="#ff4d1c"/><stop offset="100%" stop-color="#7a1c06"/></linearGradient></defs>`;
  svg.innerHTML=defs+paths;
}

// ══════════════════════════════════════
// SEND TO SIMULATOR
// ══════════════════════════════════════
function sendToSimulator() {
  const params=new URLSearchParams({
    noselen:getVal('noselen'),bodylen:getVal('bodylen'),diameter:getVal('diameter'),
    finspan:getVal('finspan'),finroot:getVal('finroot'),fintip:getVal('fintip'),
    nfins:getVal('nfins'),mass:getVal('mass'),cd:getVal('cd'),angle:90
  });
  window.location.href='simulator.html?'+params.toString();
}

// ══════════════════════════════════════
// STL VIEWER
// ══════════════════════════════════════
let stlRendererInitialised=false;
let stlRenderer,stlScene,stlCamera,stlMesh;
let stlMouseDown=false,stlLastX=0,stlLastY=0;
let stlBoundingBox=null;

function initSTLViewer() {
  stlRendererInitialised=true;
  const canvas=document.getElementById('stlCanvas');
  stlRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  stlRenderer.setSize(canvas.clientWidth,canvas.clientHeight);
  stlRenderer.setClearColor(0x06060e,1);
  stlScene=new THREE.Scene();
  stlCamera=new THREE.PerspectiveCamera(45,canvas.clientWidth/canvas.clientHeight,0.1,10000);
  stlCamera.position.set(0,0,300);
  stlScene.add(new THREE.AmbientLight(0xffffff,0.5));
  const dl=new THREE.DirectionalLight(0xffffff,0.8); dl.position.set(1,2,3); stlScene.add(dl);
  const dl2=new THREE.DirectionalLight(0xff5522,0.4); dl2.position.set(-2,-1,-1); stlScene.add(dl2);
  canvas.addEventListener('mousedown',e=>{stlMouseDown=true;stlLastX=e.clientX;stlLastY=e.clientY;});
  canvas.addEventListener('mouseup',()=>{stlMouseDown=false;});
  canvas.addEventListener('mousemove',e=>{if(!stlMouseDown||!stlMesh)return;stlMesh.rotation.y+=(e.clientX-stlLastX)*0.01;stlMesh.rotation.x+=(e.clientY-stlLastY)*0.01;stlLastX=e.clientX;stlLastY=e.clientY;});
  canvas.addEventListener('wheel',e=>{stlCamera.position.z=Math.max(10,stlCamera.position.z+e.deltaY*0.3);});
  animateSTL();
}

function animateSTL() {
  requestAnimationFrame(animateSTL);
  if (stlMesh&&!stlMouseDown) stlMesh.rotation.y+=0.005;
  stlRenderer.render(stlScene,stlCamera);
}

function handleDragOver(e)  { e.preventDefault(); document.getElementById('uploadZone').classList.add('dragover'); }
function handleDragLeave()  { document.getElementById('uploadZone').classList.remove('dragover'); }
function handleDrop(e)      { e.preventDefault(); document.getElementById('uploadZone').classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(f&&f.name.endsWith('.stl')) processSTLFile(f); }
function handleSTLUpload(e) { const f=e.target.files[0]; if(f) processSTLFile(f); }

function processSTLFile(file) {
  const status=document.getElementById('stlStatus');
  status.textContent=`Loading ${file.name}...`;
  if (!stlRendererInitialised) initSTLViewer();
  const reader=new FileReader();
  reader.onload=e=>{try{displaySTL(parseSTL(e.target.result),file.name);}catch{status.textContent='❌ Could not parse STL file.';}};
  reader.readAsArrayBuffer(file);
}

function parseSTL(buffer) {
  const view=new DataView(buffer);
  const numTri=view.getUint32(80,true);
  const expected=84+numTri*50;
  const isBinary=Math.abs(buffer.byteLength-expected)<10;
  if (isBinary) {
    const positions=[];
    for (let i=0;i<numTri;i++) {
      const off=84+i*50;
      for (let v=0;v<3;v++){const vo=off+12+v*12;positions.push(view.getFloat32(vo,true),view.getFloat32(vo+4,true),view.getFloat32(vo+8,true));}
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.computeVertexNormals(); return g;
  } else {
    const text=new TextDecoder().decode(buffer),positions=[];
    const re=/vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
    let m; while((m=re.exec(text))!==null) positions.push(parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3]));
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.computeVertexNormals(); return g;
  }
}

function displaySTL(geometry,filename) {
  if (stlMesh){stlScene.remove(stlMesh);stlMesh=null;}
  geometry.computeBoundingBox();
  const box=geometry.boundingBox,centre=new THREE.Vector3();
  box.getCenter(centre); geometry.translate(-centre.x,-centre.y,-centre.z);
  const size=new THREE.Vector3(); box.getSize(size);
  stlBoundingBox={x:size.x.toFixed(1),y:size.y.toFixed(1),z:size.z.toFixed(1)};
  const maxDim=Math.max(size.x,size.y,size.z),scale=150/maxDim;
  geometry.scale(scale,scale,scale);
  stlMesh=new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({color:0xff4d1c,specular:0x444444,shininess:40,side:THREE.DoubleSide}));
  stlScene.add(stlMesh);
  stlCamera.position.z=200;
  const numTri=geometry.attributes.position.count/3;
  document.getElementById('stlDims').style.display='grid';
  document.getElementById('stl-length').textContent=stlBoundingBox.z;
  document.getElementById('stl-width').textContent=stlBoundingBox.x;
  document.getElementById('stl-height').textContent=stlBoundingBox.y;
  document.getElementById('stl-triangles').textContent=Math.round(numTri).toLocaleString();
  document.getElementById('stlStatus').textContent=`✅ ${filename} loaded.`;
  document.getElementById('stlSendBtn').style.display='block';
}

function sendSTLToSimulator() {
  if (!stlBoundingBox) return;
  const dims=[parseFloat(stlBoundingBox.x),parseFloat(stlBoundingBox.y),parseFloat(stlBoundingBox.z)].sort((a,b)=>a-b);
  const diameter=dims[0].toFixed(0),totalLen=dims[2].toFixed(0);
  const params=new URLSearchParams({diameter,noselen:(totalLen*0.25).toFixed(0),bodylen:(totalLen*0.65).toFixed(0),finspan:(diameter*2).toFixed(0),finroot:(diameter*1.5).toFixed(0),fintip:(diameter*0.7).toFixed(0),nfins:3,mass:150,cd:0.75,angle:90});
  window.location.href='simulator.html?'+params.toString();
}

drawRocket();