import express from 'express';

// ============================================================================
// Raft Consensus Engine - Core Lab Simulation
// ============================================================================

export class RaftNode {
  public id: string;
  public state: 'follower' | 'candidate' | 'leader' = 'follower';
  public currentTerm = 0;
  public log: { term: number; vote: string }[] = [];
  public votedFor: string | null = null;
  
  private electionTimeout: any = null;
  private heartbeatInterval: any = null;
  private cluster: RaftNode[] = [];

  constructor(id: string) {
    this.id = id;
    this.resetElectionTimeout();
  }

  public setCluster(nodes: RaftNode[]) {
    this.cluster = nodes.filter(node => node.id !== this.id);
  }

  private resetElectionTimeout() {
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    const randomizedTimeout = Math.floor(Math.random() * 150) + 150;

    this.electionTimeout = setTimeout(() => {
      if (this.state !== 'leader') {
        this.startElection();
      }
    }, randomizedTimeout);
  }

  private startElection() {
    this.state = 'candidate';
    this.currentTerm++;
    this.votedFor = this.id;
    let votesCount = 1; 

    console.log(`⚡ [ELECTION] ${this.id} started election for Term [${this.currentTerm}].`);
    this.resetElectionTimeout();

    for (const peer of this.cluster) {
      const lastLogIndex = this.log.length - 1;
      const lastLogTerm = this.log.length > 0 ? this.log[lastLogIndex].term : 0;
      
      const voteGranted = peer.receiveVoteRequest(this.id, this.currentTerm, lastLogIndex, lastLogTerm);
      if (voteGranted) votesCount++;
    }

    const totalNodes = this.cluster.length + 1; // إجمالي عدد السيرفرات N
    const quorum = Math.floor(totalNodes / 2) + 1; // القانون الصريح: N/2 + 1
    
    if (votesCount >= quorum) {
      this.becomeLeader();
    }
  }

  public receiveVoteRequest(candidateId: string, candTerm: number, candLastLogIndex: number, candLastLogTerm: number): boolean {
    if (candTerm > this.currentTerm) {
      this.currentTerm = candTerm;
      this.state = 'follower';
      this.votedFor = null;
    }

    if (candTerm === this.currentTerm && (this.votedFor === null || this.votedFor === candidateId)) {
      const localLastLogIndex = this.log.length - 1;
      const localLastLogTerm = this.log.length > 0 ? this.log[localLastLogIndex].term : 0;

      if (candTerm >= localLastLogTerm && candLastLogIndex >= localLastLogIndex) {
        this.votedFor = candidateId;
        this.resetElectionTimeout();
        return true;
      }
    }
    return false;
  }

  private becomeLeader() {
    this.state = 'leader';
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    console.log(`👑 [LEADER] ${this.id} won the election for Term [${this.currentTerm}].`);

    this.heartbeatInterval = setInterval(() => {
      if (this.state !== 'leader') {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        return;
      }
      for (const peer of this.cluster) {
        peer.receiveHeartbeat(this.id, this.currentTerm);
      }
    }, 50);
  }

  public receiveHeartbeat(leaderId: string, term: number) {
    if (term >= this.currentTerm) {
      this.state = 'follower';
      this.currentTerm = term;
      this.votedFor = null;
      this.resetElectionTimeout();
    }
  }

  public clientProposeVote(voteData: string): boolean {
    if (this.state !== 'leader') return false;

    const newEntry = { term: this.currentTerm, vote: voteData };
    this.log.push(newEntry);
    
    let replicationSuccessCount = 1;
    for (const peer of this.cluster) {
      const replicated = peer.replicateLogEntry(newEntry);
      if (replicated) replicationSuccessCount++;
    }

    const totalNodes = this.cluster.length + 1; // إجمالي عدد السيرفرات N
    const quorum = Math.floor(totalNodes / 2) + 1; // القانون الصريح: N/2 + 1    if (replicationSuccessCount >= quorum) {
    if (replicationSuccessCount >= quorum) {
      return true;
    } else {
      this.log.pop();
      return false;
    }
  }

  public replicateLogEntry(entry: { term: number; vote: string }): boolean {
    this.log.push(entry);
    return true;
  }

  public crashNode() {
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.state = 'follower';
    console.log(`💥 [CRASH] ${this.id} disconnected!`);
  }
}

// ============================================================================
// تشغيل الـ 3 سيرفرات وإطلاق خادم ويب لعرض النتائج على المتصفح حياً
// ============================================================================

const node1 = new RaftNode('Raft-1');
const node2 = new RaftNode('Raft-2');
const node3 = new RaftNode('Raft-3');

const cluster = [node1, node2, node3];
node1.setCluster(cluster);
node2.setCluster(cluster);
node3.setCluster(cluster);

const app = express();
app.use(express.json());

// واجهة الـ HTML التفاعلية لمشاهدة الـ Cluster حياً
app.get('/', (req, res) => {
    const nodesHtml = cluster.map(n => {
        let badgeColor = 'bg-gray-600';
        if (n.state === 'leader') badgeColor = 'bg-green-600 animate-pulse';
        if (n.state === 'candidate') badgeColor = 'bg-yellow-600';
        
        return `
            <div class="border border-slate-700 bg-slate-800 p-6 rounded-xl shadow-md text-slate-100">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">${n.id}</h3>
                    <span class="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${badgeColor}">${n.state}</span>
                </div>
                <p class="text-sm text-slate-400 mb-2">Current Term: <span class="text-cyan-400 font-mono font-bold">${n.currentTerm}</span></p>
                <p class="text-sm text-slate-400 mb-2">Voted For: <span class="text-slate-300 font-mono">${n.votedFor || 'None'}</span></p>
                <div class="mt-4">
                    <span class="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-1">Committed Votes Log:</span>
                    <div class="bg-slate-950 p-3 rounded font-mono text-xs max-h-24 overflow-y-auto border border-slate-800 text-emerald-400">
                        ${n.log.length > 0 ? n.log.map(l => `[Term ${l.term}] ${l.vote}`).join('<br>') : 'No committed logs'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Raft Consensus Live Sandbox</title>
            <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        </head>
        <body class="bg-slate-900 text-slate-100 font-sans min-h-screen py-10 px-4">
            <div class="max-w-4xl mx-auto">
                <header class="border-b border-slate-800 pb-4 mb-8">
                    <span class="text-xs font-bold text-cyan-400 tracking-widest uppercase">Expert Distributed Systems Lab</span>
                    <h1 class="text-3xl font-extrabold text-white mt-1">Raft Consensus Protocol Coordinator</h1>
                    <p class="text-sm text-slate-500 mt-2">قم بعمل Refresh (تحديث) للصفحة لتشاهد تقلبات القائد والانتخابات الحية وتلقي الأصوات التزامني.</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    ${nodesHtml}
                </div>

                <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl flex gap-4">
                    <button onclick="fetch('/vote', {method:'POST'}).then(()=>location.reload())" class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition cursor-pointer">
                        🗳️ Simulate Precinct Ballot Vote (Quorum Sync)
                    </button>
                    <button onclick="fetch('/crash', {method:'POST'}).then(()=>location.reload())" class="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition cursor-pointer">
                        💥 Crash Active Leader Node
                    </button>
                </div>
            </div>
        </body>
        </html>
    `);
});

// راوت لمحاكاة إدخال صوت انتخابي جديد للقائد الحالي ومزامنته عبر الـ Quorum
app.post('/vote', (req, res) => {
    const leader = cluster.find(n => n.state === 'leader');
    if (leader) {
        const randomVoteId = Math.floor(Math.random() * 900) + 100;
        leader.clientProposeVote(`Vote_ID_${randomVoteId}: Precinct_Vault_Secured`);
        res.json({ status: 'success' });
    } else {
        res.status(500).json({ status: 'no leader' });
    }
});

// راوت لمحاكاة إسقاط القائد فوراً لتفعيل إعادة الانتخاب التلقائي
app.post('/crash', (req, res) => {
    const leader = cluster.find(n => n.state === 'leader');
    if (leader) {
        leader.crashNode();
        res.json({ status: 'success' });
    } else {
        res.status(500).json({ status: 'no active leader to crash' });
    }
});

// تشغيل السيرفر على البورت 3000
app.listen(8080, () => {
    console.log('\n🚀 [SERVER READY] Raft Visual Sandbox live at http://localhost:8080');
});