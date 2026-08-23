import * as THREE from 'three';

export function createParticleWhale() {
    const L = 9.0, RMAX = 1.05;
    const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
    const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};

    function profile(u){
        const rise = smooth(0.02,0.42,u);         
        const girth = 0.5 + 0.5*rise;
        const chest = 1 - 0.08*smooth(0.55,1.0,u);
        let head = 1.0;
        if(u>0.80){                               
            const h=(u-0.80)/0.20;
            head = Math.sqrt(Math.max(0,1-h*h))*0.82 + 0.18;
        }
        const tail = smooth(0.0,0.13,u);          
        return Math.max(0, girth*chest*head*tail);
    }
    const headen=u=>smooth(0.75,1.0,u);         
    const jawDrop=u=>RMAX*0.28*smooth(0.80,1.0,u); 

    const pos=[], uarr=[], size=[], seed=[], part=[], vent=[]; 
    function push(x,y,z,u,s,p){
        pos.push(x,y,z);uarr.push(u);size.push(s);seed.push(Math.random());part.push(p);
        vent.push(clamp(0.5 - y/(RMAX*1.6), 0, 1));          
    }

    const N_BODY=15000, N_PEC=3200, N_FLUKE=2800, N_DORSAL=900;

    for(let i=0;i<N_BODY;i++){
        const u=Math.random();
        const r=profile(u); if(r<0.02){i--;continue;}
        const x=(u-0.5)*L;
        const th=Math.random()*Math.PI*2;
        const rr=RMAX*r;
        const hd=headen(u);
        let y=rr*Math.sin(th)*(1.0-0.15*hd);                
        let z=rr*(0.92+0.20*hd)*Math.cos(th);               
        if(y<0){ y*=0.85; y-=jawDrop(u); }                  
        const j=0.04;
        push(x, y+(Math.random()*2-1)*j, z+(Math.random()*2-1)*j, u, 0.5+Math.random()*0.5, 0);
    }
    for(const side of [1,-1]) for(let i=0;i<320;i++){
        const u=0.72+Math.random()*0.27;
        const r=profile(u)*RMAX;
        const rz=r*(0.92+0.20*headen(u));
        const back=smooth(0.72,0.83,u);                     
        const y=-r*0.12 + back*0.24;
        push((u-0.5)*L, y, side*rz*0.98, 0.9, 0.85+Math.random()*0.4, 0);
    }
    for(const side of [1,-1]) for(let i=0;i<45;i++){
        const u=0.78, r=profile(u)*RMAX, rz=r*(0.92+0.20*headen(u));
        push((u-0.5)*L+(Math.random()*2-1)*0.05, -r*0.12+0.30+(Math.random()*2-1)*0.04,
             side*rz*0.9, 0.9, 1.0, 0);
    }
    for(let i=0;i<340;i++){
        const u=0.82+Math.random()*0.17;
        const r=profile(u)*RMAX, hd=headen(u);
        const rz=r*(0.92+0.20*hd);
        const onJaw=Math.random()<0.35;
        const z=(Math.random()*2-1)*rz*0.5;
        const y=onJaw ? (-r*0.85 - jawDrop(u)) : (r*(1.0-0.15*hd)*0.92 + 0.03);
        push((u-0.5)*L+(Math.random()*2-1)*0.04, y+(Math.random()*2-1)*0.03, z, 0.9, 0.8+Math.random()*0.5, 0);
    }
    function pec(side){
        const u0=0.60, base=profile(u0)*RMAX;
        const x0=(u0-0.5)*L, y0=-0.30, z0=side*base*0.85;
        const Lf=2.6;                                        
        for(let i=0;i<N_PEC/2;i++){
            const s=Math.random();                             
            const t=(Math.random()*2-1);                       
            const Wf=0.18+0.34*Math.sin(Math.PI*clamp(s*0.9+0.06,0,1)); 
            let x=x0 + s*0.45 + t*Wf;                           
            let y=y0 - s*1.05 + t*Wf*0.12;                      
            let z=z0 + side*s*Lf;                               
            if(t>0.65) x += Math.sin(s*26.0)*0.06;             
            push(x, y, z, u0, 0.7+Math.random()*0.5, 1);
        }
    }
    pec(1); pec(-1);
    for(let i=0;i<N_FLUKE;i++){
        const lobe=Math.random()<0.5?1:-1;
        const s=Math.random();                   
        const c=(Math.random()*2-1);             
        const spread=s*2.4;                      
        let z=lobe*(0.12+spread);
        let x=(0.02-0.5)*L - 0.2 - spread*0.35 - Math.abs(c)*(0.5*(1-s*0.5));
        x -= Math.abs(Math.sin(spread*4.0))*0.06*(c<0?1:0);   
        let y=c*0.1;
        if(Math.abs(z)<0.18 && c>0.2){i--;continue;}
        push(x,y,z,0.03,0.7+Math.random()*0.5,2);
    }
    for(let k=-5;k<=5;k++){
        for(let i=0;i<150;i++){
            const u=0.5+Math.random()*0.32;
            const r=profile(u)*RMAX;
            const halfz=r*0.82;
            const z=(k/5)*halfz;
            if(Math.abs(z)>halfz) continue;
            const x=(u-0.5)*L;
            let y=-Math.sqrt(Math.max(0, r*r - z*z))*0.9;      
            y-=RMAX*0.35*smooth(0.72,1.0,u);                    
            y+=Math.sin(k*1.6)*0.015;                           
            push(x+(Math.random()*2-1)*0.03, y, z+(Math.random()*2-1)*0.02, u, 0.45+Math.random()*0.4, 0);
        }
    }
    for(let i=0;i<N_DORSAL;i++){
        const u=0.36+Math.random()*0.12;
        const r=profile(u)*RMAX;
        const x=(u-0.5)*L+(Math.random()*2-1)*0.2;
        const z=(Math.random()*2-1)*0.18;
        const y=r*0.9 + smooth(0.36,0.42,u)*(1-smooth(0.42,0.48,u))*0.5 + Math.random()*0.05;
        push(x,y,z,u,0.7+Math.random()*0.4,3);
    }

    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute("aU",new THREE.Float32BufferAttribute(uarr,1));
    geo.setAttribute("aSize",new THREE.Float32BufferAttribute(size,1));
    geo.setAttribute("aSeed",new THREE.Float32BufferAttribute(seed,1));
    geo.setAttribute("aPart",new THREE.Float32BufferAttribute(part,1));
    geo.setAttribute("aVent",new THREE.Float32BufferAttribute(vent,1));

    const mat=new THREE.ShaderMaterial({
        uniforms:{uTime:{value:0}, uPix:{value:Math.min(window.devicePixelRatio||1, 2)}},
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog: false,
        vertexShader:`
            uniform float uTime, uPix;
            attribute float aU, aSize, aSeed, aPart, aVent;
            varying float vU, vSeed, vPart, vVent;
            void main(){
                vU=aU; vSeed=aSeed; vPart=aPart; vVent=aVent;
                vec3 p=position;
                float u=aU;
                float bend=smoothstep(0.92,0.0,u);          
                float bend2=bend*bend;
                float phase=u*5.0 - uTime*2.6;
                p.y += sin(phase) * (0.12 + 0.9*bend2);
                p.z += sin(u*3.5 - uTime*2.6) * 0.12 * bend;
                float isPec = step(0.5,aPart)*step(aPart,1.5);
                float tipOut = clamp((abs(position.z)-0.9)*0.5, 0.0, 1.0);
                p.y += isPec * sin(uTime*1.7) * tipOut * 0.6;
                p.y += sin(uTime*0.9 + aSeed*6.28)*0.02;
                vec4 mv=modelViewMatrix*vec4(p,1.0);
                float tw=0.7+0.3*sin(uTime*2.0+aSeed*20.0);
                // Compensate for scale 14 by scaling base point size from 48.0 to ~650.0
                gl_PointSize=aSize*uPix*tw*(650.0/-mv.z);
                gl_Position=projectionMatrix*mv;
            }`,
        fragmentShader:`
            varying float vU, vSeed, vPart, vVent;
            void main(){
                float d=length(gl_PointCoord-0.5);
                if(d>0.5) discard;
                float a=pow(smoothstep(0.5,0.0,d),1.6);      
                vec3 back=vec3(0.28,0.52,0.86);              
                vec3 belly=vec3(1.0,1.0,1.0);                
                vec3 col=mix(back, belly, vVent);
                col=mix(col, vec3(1.0,0.80,0.5), (vPart>1.5?0.16:0.05)); 
                col+=vSeed*0.04;
                float br=0.24+0.16*vVent;                    
                gl_FragColor=vec4(col, a*br);
            }`
    });

    // Make it compatible with the existing update loop logic
    mat.userData.shader = mat;

    const whale=new THREE.Points(geo,mat);

    // Return the Points mesh directly
    return { group: whale, material: mat };
}
