import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import Sidebar from './src/components/Sidebar';
import TopBar from './src/components/TopBar';
import DashboardPage from './src/pages/DashboardPage';
import Simulation3DModal from './src/components/Simulation3DModal';
import useFleetState from './src/store/useFleetState';
import client from './src/api/client';
import './src/index.css';
const geometry=Array.from({length:100},(_,i)=>[-46.66+i*.0002,-23.55+Math.sin(i/12)*.0004]);
const trucks=Array.from({length:10},(_,i)=>({id:9001+i,plate:'STU-'+(6789+i),model:'Scania G410',route_index:20,route_geometry:geometry,lat:geometry[20][1]+i*.003,lng:geometry[20][0]+i*.003,status:i===3?'low_fuel':'ok',sim_state:'driving',speed_kmh:64,capacity_liters:400,current_level_liters:280,origin_name:'São Paulo',dest_name:'Campinas',current_drivers:[{id:i,name:'Motorista de teste'}]}));
const routes=Object.fromEntries(trucks.map(t=>[t.id,geometry]));
const update=()=>useFleetState.setState({fleet:trucks,truckRoutes:routes,loading:false,error:null});
useFleetState.setState({fetchFleet:async()=>{},fetchTruckRoute:async()=>{},fetchAlerts:async()=>{},fetchLiveEvents:async()=>{},alerts:[]});
useFleetState.subscribe(s=>{if(s.fleet.some(t=>t.id<9001))update();});update();
client.defaults.adapter=async config=>({data:[],status:200,statusText:'OK',headers:{},config});
function App(){const [open,setOpen]=useState(false);return <MemoryRouter><div className="app-shell"><Sidebar/><div className="app-content"><TopBar/><main className="app-main"><button className="panel-button" onClick={()=>setOpen(true)}>Abrir mapa para revisão</button><DashboardPage/></main></div></div><Simulation3DModal isOpen={open} onClose={()=>setOpen(false)} truck={trucks[0]}/></MemoryRouter>}
createRoot(document.getElementById('root')).render(<App/>);
