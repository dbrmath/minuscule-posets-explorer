(function exposeMinusculeCore(global) {
  "use strict";

  function normalizeType(typeInput) {
    const type = String(typeInput || "A").trim().toUpperCase();
    if (!["A", "D", "E"].includes(type)) {
      throw new Error(`Unsupported Lie type: ${typeInput}`);
    }
    return type;
  }

  function supportedTypes() {
    return ["A", "D", "E"];
  }

  function supportedRanks(typeInput) {
    const type = normalizeType(typeInput);
    if (type === "A") {
      return [2, 3, 4, 5, 6, 7, 8];
    }
    if (type === "D") {
      return [4, 5, 6, 7, 8];
    }
    return [6, 7];
  }

  function minusculeWeights(typeInput, nInput) {
    const type = normalizeType(typeInput);
    const n = Number(nInput);
    if (!Number.isInteger(n)) {
      return [];
    }

    if (type === "A") {
      if (n < 2) {
        return [];
      }
      const out = [];
      for (let i = 1; i <= n; i += 1) {
        out.push(i);
      }
      return out;
    }

    if (type === "D") {
      if (n < 4) {
        return [];
      }
      return [1, n - 1, n];
    }

    if (n === 6) {
      return [1, 6];
    }
    if (n === 7) {
      return [7];
    }
    return [];
  }

  function isMinusculeTriple(typeInput, nInput, kInput) {
    const n = Number(nInput);
    const k = Number(kInput);
    if (!Number.isInteger(n) || !Number.isInteger(k)) {
      return false;
    }
    return minusculeWeights(typeInput, n).includes(k);
  }

  function buildMinusculePoset(typeInput, nInput, kInput) {
    const type = normalizeType(typeInput);
    const n = Number(nInput);
    const k = Number(kInput);

    if (!Number.isInteger(n) || !Number.isInteger(k)) {
      throw new Error("buildMinusculePoset requires integer rank n and index k.");
    }

    const allowedRanks = supportedRanks(type);
    if (!allowedRanks.includes(n)) {
      throw new Error(
        `Unsupported rank n=${n} for type ${type}. Allowed ranks: ${allowedRanks.join(", ")}.`
      );
    }

    const allowedWeights = minusculeWeights(type, n);
    if (!allowedWeights.includes(k)) {
      throw new Error(
        `Weight index k=${k} is not minuscule for ${type}_${n}. Allowed: ${allowedWeights.join(", ")}.`
      );
    }

    if (type === "A") {
      return buildTypeAPoset(n, k);
    }

    return buildNonTypeAMinusculePoset(type, n, k);
  }

  function buildTypeAPoset(n, k) {
    if (!Number.isInteger(n) || !Number.isInteger(k)) {
      throw new Error("buildTypeAPoset requires integer n and k.");
    }
    if (n < 2) {
      throw new Error("Type A rank n must satisfy n >= 2.");
    }
    if (k < 1 || k > n) {
      throw new Error("Minuscule index k must satisfy 1 <= k <= n.");
    }

    const cols = n + 1 - k;
    const nodes = [];

    for (let row = 1; row <= k; row += 1) {
      for (let col = 1; col <= cols; col += 1) {
        const index = nodes.length;
        const preds = [];
        if (row > 1) {
          preds.push((row - 2) * cols + (col - 1));
        }
        if (col > 1) {
          preds.push((row - 1) * cols + (col - 2));
        }

        const label = k - row + col;
        if (label < 1 || label > n) {
          throw new Error(`Label ${label} is out of range for A_${n}.`);
        }

        nodes.push({
          index,
          row,
          col,
          label,
          preds,
          succs: [],
          rank: row + col,
          drawX: col - row,
          drawY: row + col,
          display: `(${row},${col})`,
        });
      }
    }

    for (const node of nodes) {
      for (const predIndex of node.preds) {
        nodes[predIndex].succs.push(node.index);
      }
    }

    ensureBitmaskCapacity(nodes.length);

    const labelToIndices = new Map();
    for (let label = 1; label <= n; label += 1) {
      labelToIndices.set(label, []);
    }

    const rankToIndices = new Map();
    let rankMin = Infinity;
    let rankMax = -Infinity;

    for (const node of nodes) {
      labelToIndices.get(node.label).push(node.index);

      const rank = node.rank;
      if (!rankToIndices.has(rank)) {
        rankToIndices.set(rank, []);
      }
      rankToIndices.get(rank).push(node.index);

      if (rank < rankMin) {
        rankMin = rank;
      }
      if (rank > rankMax) {
        rankMax = rank;
      }
    }

    const highestWeight = Array(n).fill(0);
    highestWeight[k - 1] = 1;

    const cartan = cartanTypeA(n);
    const inverseColumnFractions = inverseCartanColumnFractions(cartan, k);

    return {
      type: "A",
      n,
      k,
      cols,
      nodes,
      labelToIndices,
      rankToIndices,
      rankMin,
      rankMax,
      cartan,
      highestWeight,
      expectedIdeals: binomial(n + 1, k),
      coxeterNumber: coxeterNumber("A", n),
      inverseCartanColumnFractions: inverseColumnFractions,
      inverseCartanColumnNumbers: inverseColumnFractions.map(fracToNumber),
      representation: representationMetadata("A", n, k),
      knownWeightKeys: null,
    };
  }

  function buildNonTypeAMinusculePoset(type, n, k) {
    const cartan = cartanForType(type, n);
    const highestWeight = Array(n).fill(0);
    highestWeight[k - 1] = 1;

    const lattice = buildWeightLattice(cartan, highestWeight);
    const joinData = buildJoinIrreduciblePoset(lattice, n, { type, n, k });

    const nodes = joinData.nodes;
    ensureBitmaskCapacity(nodes.length);

    const labelToIndices = new Map();
    for (let label = 1; label <= n; label += 1) {
      labelToIndices.set(label, []);
    }
    for (const node of nodes) {
      labelToIndices.get(node.label).push(node.index);
    }

    const rankToIndices = new Map();
    let rankMin = Infinity;
    let rankMax = -Infinity;
    for (const node of nodes) {
      const rank = node.rank;
      if (!rankToIndices.has(rank)) {
        rankToIndices.set(rank, []);
      }
      rankToIndices.get(rank).push(node.index);
      if (rank < rankMin) {
        rankMin = rank;
      }
      if (rank > rankMax) {
        rankMax = rank;
      }
    }

    const inverseColumnFractions = inverseCartanColumnFractions(cartan, k);

    return {
      type,
      n,
      k,
      nodes,
      labelToIndices,
      rankToIndices,
      rankMin,
      rankMax,
      cartan,
      highestWeight,
      expectedIdeals: lattice.weights.length,
      coxeterNumber: coxeterNumber(type, n),
      inverseCartanColumnFractions: inverseColumnFractions,
      inverseCartanColumnNumbers: inverseColumnFractions.map(fracToNumber),
      representation: representationMetadata(type, n, k),
      knownWeightKeys: new Set(lattice.weights.map((weight) => weight.join(","))),
    };
  }

  function ensureBitmaskCapacity(nodeCount) {
    if (nodeCount > 31) {
      throw new Error(
        `This static app uses 32-bit masks; received ${nodeCount} poset nodes (max 31 supported).`
      );
    }
  }

  function cartanForType(type, n) {
    if (type === "A") {
      return cartanTypeA(n);
    }
    if (type === "D") {
      return cartanTypeD(n);
    }
    return cartanTypeE(n);
  }

  function cartanTypeA(n) {
    const matrix = [];
    for (let i = 0; i < n; i += 1) {
      const row = Array(n).fill(0);
      row[i] = 2;
      if (i > 0) {
        row[i - 1] = -1;
      }
      if (i < n - 1) {
        row[i + 1] = -1;
      }
      matrix.push(row);
    }
    return matrix;
  }

  function cartanTypeD(n) {
    const edges = [];
    for (let i = 1; i <= n - 3; i += 1) {
      edges.push([i, i + 1]);
    }
    edges.push([n - 2, n - 1]);
    edges.push([n - 2, n]);
    return cartanFromEdges(n, edges);
  }

  function cartanTypeE(n) {
    if (n === 6) {
      // Bourbaki-style numbering with branch at node 4.
      return cartanFromEdges(6, [
        [1, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [2, 4],
      ]);
    }

    if (n === 7) {
      return cartanFromEdges(7, [
        [1, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [2, 4],
      ]);
    }

    throw new Error(`Unsupported E-rank: ${n}. This app supports E6 and E7.`);
  }

  function cartanFromEdges(rank, edges) {
    const matrix = [];
    for (let i = 0; i < rank; i += 1) {
      const row = Array(rank).fill(0);
      row[i] = 2;
      matrix.push(row);
    }

    for (const [a, b] of edges) {
      const i = a - 1;
      const j = b - 1;
      matrix[i][j] = -1;
      matrix[j][i] = -1;
    }

    return matrix;
  }

  function coxeterNumber(typeInput, n) {
    const type = normalizeType(typeInput);
    if (type === "A") {
      return n + 1;
    }
    if (type === "D") {
      return 2 * n - 2;
    }
    if (n === 6) {
      return 12;
    }
    if (n === 7) {
      return 18;
    }
    throw new Error(`Unsupported Coxeter number request for ${type}_${n}.`);
  }

  function representationMetadata(typeInput, n, k) {
    const type = normalizeType(typeInput);

    if (type === "A") {
      return {
        model: `V(ω_${k}) = ∧^${k}(ℂ^${n + 1})`,
        highestWeight: `ω_${k}`,
        notes: [
          `Type A_${n} minuscule model with subset realization in the standard basis of ℂ^${n + 1}.`,
        ],
      };
    }

    if (type === "D") {
      if (k === 1) {
        return {
          model: `V(ω_1) for so(2${n}) (vector representation)`,
          highestWeight: "ω_1",
          notes: ["Weights are ±e_i in the standard orthogonal realization."],
        };
      }
      return {
        model: `V(ω_${k}) for so(2${n}) (half-spin representation)`,
        highestWeight: `ω_${k}`,
        notes: ["Spin weights correspond to parity-constrained sign choices in the e_i model."],
      };
    }

    if (n === 6) {
      return {
        model: `V(ω_${k}) for E_6 (minuscule 27-dimensional representation)`,
        highestWeight: `ω_${k}`,
        notes: ["The two minuscule nodes are dual (k = 1 or 6)."],
      };
    }

    return {
      model: "V(ω_7) for E_7 (56-dimensional minuscule representation)",
      highestWeight: "ω_7",
      notes: ["Unique minuscule representation in type E_7."],
    };
  }

  function buildWeightLattice(cartan, highestWeight) {
    const n = cartan.length;
    const weights = [];
    const weightToIndex = new Map();

    function addWeight(weight) {
      const key = weight.join(",");
      if (weightToIndex.has(key)) {
        return weightToIndex.get(key);
      }
      const index = weights.length;
      weights.push(weight.slice());
      weightToIndex.set(key, index);
      return index;
    }

    const topIndex = addWeight(highestWeight.slice());

    for (let q = 0; q < weights.length; q += 1) {
      const weight = weights[q];
      for (let label = 1; label <= n; label += 1) {
        addWeight(reflect(weight, label, cartan));
      }
    }

    const downEdges = Array.from({ length: weights.length }, () => []);
    const upEdges = Array.from({ length: weights.length }, () => []);

    for (let from = 0; from < weights.length; from += 1) {
      const weight = weights[from];
      for (let label = 1; label <= n; label += 1) {
        const pairing = weight[label - 1];
        if (pairing > 0) {
          const reflected = reflect(weight, label, cartan);
          const to = weightToIndex.get(reflected.join(","));
          if (to === undefined) {
            throw new Error("Internal error while orienting weight lattice edges.");
          }
          downEdges[from].push({ to, label });
          upEdges[to].push({ from, label });
        }
      }
    }

    const indegree = upEdges.map((incoming) => incoming.length);
    const queue = [];
    for (let i = 0; i < indegree.length; i += 1) {
      if (indegree[i] === 0) {
        queue.push(i);
      }
    }

    const topological = [];
    const depthFromTop = Array(weights.length).fill(0);

    for (let q = 0; q < queue.length; q += 1) {
      const current = queue[q];
      topological.push(current);

      for (const edge of downEdges[current]) {
        const next = edge.to;
        if (depthFromTop[next] < depthFromTop[current] + 1) {
          depthFromTop[next] = depthFromTop[current] + 1;
        }
        indegree[next] -= 1;
        if (indegree[next] === 0) {
          queue.push(next);
        }
      }
    }

    if (topological.length !== weights.length) {
      throw new Error("Weight graph orientation has a cycle; expected a DAG.");
    }

    const downClosure = Array(weights.length);
    for (let i = topological.length - 1; i >= 0; i -= 1) {
      const node = topological[i];
      const closure = new Set([node]);
      for (const edge of downEdges[node]) {
        for (const item of downClosure[edge.to]) {
          closure.add(item);
        }
      }
      downClosure[node] = closure;
    }

    const maxDepth = depthFromTop.reduce((acc, value) => Math.max(acc, value), 0);

    return {
      n,
      weights,
      weightToIndex,
      topIndex,
      downEdges,
      upEdges,
      topological,
      depthFromTop,
      maxDepth,
      downClosure,
    };
  }

  function buildJoinIrreduciblePoset(lattice, n, layoutProfile) {
    const joinLatIndices = [];
    for (let idx = 0; idx < lattice.weights.length; idx += 1) {
      if (lattice.downEdges[idx].length === 1) {
        joinLatIndices.push(idx);
      }
    }

    if (joinLatIndices.length === 0) {
      throw new Error("No join-irreducibles found in the weight lattice.");
    }

    joinLatIndices.sort((a, b) => {
      const da = lattice.depthFromTop[a];
      const db = lattice.depthFromTop[b];
      if (da !== db) {
        return db - da;
      }
      const la = lattice.downEdges[a][0].label;
      const lb = lattice.downEdges[b][0].label;
      if (la !== lb) {
        return la - lb;
      }
      return a - b;
    });

    const m = joinLatIndices.length;
    const lessEq = Array.from({ length: m }, () => Array(m).fill(false));

    for (let a = 0; a < m; a += 1) {
      for (let b = 0; b < m; b += 1) {
        // Use the lattice order dual so the empty ideal maps to the highest
        // weight under phi (matching the Type A model used in this app).
        if (lattice.downClosure[joinLatIndices[a]].has(joinLatIndices[b])) {
          lessEq[a][b] = true;
        }
      }
    }

    const nodes = [];
    for (let i = 0; i < m; i += 1) {
      const latIndex = joinLatIndices[i];
      nodes.push({
        index: i,
        label: lattice.downEdges[latIndex][0].label,
        preds: [],
        succs: [],
        rank: 0,
        drawX: 0,
        drawY: 0,
        display: `j${i + 1}`,
        latticeIndex: latIndex,
      });
    }

    for (let a = 0; a < m; a += 1) {
      for (let b = 0; b < m; b += 1) {
        if (a === b || !lessEq[a][b] || lessEq[b][a]) {
          continue;
        }

        let isCover = true;
        for (let c = 0; c < m; c += 1) {
          if (c === a || c === b) {
            continue;
          }
          if (lessEq[a][c] && lessEq[c][b]) {
            isCover = false;
            break;
          }
        }

        if (isCover) {
          nodes[a].succs.push(b);
          nodes[b].preds.push(a);
        }
      }
    }

    const ranks = computeRanks(nodes);
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].rank = ranks[i];
    }

    assignGenericDrawCoordinates(nodes, layoutProfile || {});

    const idealMaskByLatticeIndex = new Map();
    for (let latIndex = 0; latIndex < lattice.weights.length; latIndex += 1) {
      let mask = 0;
      for (let posetIndex = 0; posetIndex < joinLatIndices.length; posetIndex += 1) {
        const joinLat = joinLatIndices[posetIndex];
        if (lattice.downClosure[joinLat].has(latIndex)) {
          mask = setBit(mask, posetIndex);
        }
      }
      idealMaskByLatticeIndex.set(latIndex, mask);
    }

    return {
      nodes,
      joinLatIndices,
      lessEq,
      idealMaskByLatticeIndex,
    };
  }

  function computeRanks(nodes) {
    const indegree = nodes.map((node) => node.preds.length);
    const queue = [];
    for (let i = 0; i < indegree.length; i += 1) {
      if (indegree[i] === 0) {
        queue.push(i);
      }
    }

    const topo = [];
    const rank = Array(nodes.length).fill(0);

    for (let q = 0; q < queue.length; q += 1) {
      const current = queue[q];
      topo.push(current);

      for (const succ of nodes[current].succs) {
        rank[succ] = Math.max(rank[succ], rank[current] + 1);
        indegree[succ] -= 1;
        if (indegree[succ] === 0) {
          queue.push(succ);
        }
      }
    }

    if (topo.length !== nodes.length) {
      throw new Error("Join-irreducible graph is not acyclic.");
    }

    return rank;
  }

  function assignGenericDrawCoordinates(nodes, layoutProfile) {
    let maxRank = 0;
    for (const node of nodes) {
      if (node.rank > maxRank) {
        maxRank = node.rank;
      }
    }

    const byRank = new Map();
    for (let rank = 0; rank <= maxRank; rank += 1) {
      byRank.set(rank, []);
    }
    for (const node of nodes) {
      byRank.get(node.rank).push(node.index);
    }

    const rankOrder = orderedNodesByRank(nodes, maxRank, byRank);
    const embedded = tryAssignTwoDirectionCoordinates(
      nodes,
      maxRank,
      rankOrder,
      layoutProfile || {}
    );
    if (!embedded) {
      assignBarycenterCoordinates(nodes, maxRank, byRank);
    }
    centerDrawCoordinates(nodes);
  }

  function orderedNodesByRank(nodes, maxRank, byRank) {
    const provisionalX = new Map();
    const rankOrder = new Map();

    for (let rank = 0; rank <= maxRank; rank += 1) {
      const row = byRank.get(rank).slice();
      row.sort((a, b) => {
        const aCenter = barycenter(nodes[a].preds, provisionalX);
        const bCenter = barycenter(nodes[b].preds, provisionalX);
        if (aCenter !== bCenter) {
          return aCenter - bCenter;
        }

        const labelDiff = nodes[a].label - nodes[b].label;
        if (labelDiff !== 0) {
          return labelDiff;
        }
        return a - b;
      });
      rankOrder.set(rank, row);

      let start = -(row.length - 1);
      if ((((start % 2) + 2) % 2) !== (((rank % 2) + 2) % 2)) {
        start += 1;
      }
      for (let i = 0; i < row.length; i += 1) {
        provisionalX.set(row[i], start + 2 * i);
      }
    }

    return rankOrder;
  }

  function tryAssignTwoDirectionCoordinates(nodes, maxRank, rankOrder, layoutProfile) {
    // Require a strict rank-1 cover relation to realize edges on a triangular lattice.
    for (const node of nodes) {
      for (const succ of node.succs) {
        if ((nodes[succ].rank - node.rank) !== 1) {
          return false;
        }
      }
    }

    let maxRowSize = 0;
    for (let rank = 0; rank <= maxRank; rank += 1) {
      const row = rankOrder.get(rank) || [];
      if (row.length > maxRowSize) {
        maxRowSize = row.length;
      }
    }

    const width = Math.max(14, maxRank + maxRowSize * 3 + 6);
    const parityValues = [[], []];
    for (let x = -width; x <= width; x += 1) {
      const parity = ((x % 2) + 2) % 2;
      parityValues[parity].push(x);
    }

    const rowSizes = [];
    for (let rank = 0; rank <= maxRank; rank += 1) {
      rowSizes.push((rankOrder.get(rank) || []).length);
    }

    const profile = layoutProfile || {};
    const isDSpinProfile = (
      profile.type === "D"
      && Number.isInteger(profile.n)
      && Number.isInteger(profile.k)
      && (profile.k === profile.n - 1 || profile.k === profile.n)
    );

    const forcedEdgeDx = new Map();
    if (isDSpinProfile) {
      for (const [u, v] of bottomTailEdges(nodes)) {
        forcedEdgeDx.set(edgeKey(u, v), -1);
      }
      for (const [u, v] of topTailEdges(nodes)) {
        const key = edgeKey(u, v);
        const existing = forcedEdgeDx.get(key);
        if (existing === undefined || existing === 1) {
          forcedEdgeDx.set(key, 1);
        }
      }
    }

    const orientationSign = (
      isDSpinProfile
    )
      ? -1
      : 1;

    const centerByRank = Array(maxRank + 1).fill(0);
    let direction = orientationSign;
    for (let rank = 1; rank <= maxRank; rank += 1) {
      if (rowSizes[rank] > rowSizes[rank - 1]) {
        direction = orientationSign;
      } else if (rowSizes[rank] < rowSizes[rank - 1]) {
        direction = -orientationSign;
      }
      centerByRank[rank] = centerByRank[rank - 1] + direction;
    }

    const targetByIndex = new Map();
    for (let rank = 0; rank <= maxRank; rank += 1) {
      const row = rankOrder.get(rank) || [];
      if (row.length === 0) {
        continue;
      }

      const parity = ((rank % 2) + 2) % 2;
      const centered = nearestWithParity(centerByRank[rank], parity);
      if (row.length === 1) {
        targetByIndex.set(row[0], centered);
        continue;
      }

      const spread = row.length - 1;
      for (let i = 0; i < row.length; i += 1) {
        const raw = centered - spread + 2 * i;
        targetByIndex.set(row[i], nearestWithParity(raw, parity));
      }
    }

    const assigned = Array(nodes.length).fill(null);
    const usedByRank = Array.from({ length: maxRank + 1 }, () => new Set());

    function assign(index, x) {
      assigned[index] = x;
      usedByRank[nodes[index].rank].add(x);
    }

    function unassign(index) {
      const x = assigned[index];
      assigned[index] = null;
      usedByRank[nodes[index].rank].delete(x);
    }

    function candidateValues(index) {
      const node = nodes[index];
      const rank = node.rank;
      let candidates = null;

      for (const pred of node.preds) {
        const px = assigned[pred];
        if (px === null) {
          continue;
        }
        const forced = forcedEdgeDx.get(edgeKey(pred, index));
        const options = forced === undefined
          ? [px - 1, px + 1]
          : [px + forced];
        candidates = candidates === null
          ? options
          : candidates.filter((value) => options.includes(value));
      }

      for (const succ of node.succs) {
        const sx = assigned[succ];
        if (sx === null) {
          continue;
        }
        const forced = forcedEdgeDx.get(edgeKey(index, succ));
        const options = forced === undefined
          ? [sx - 1, sx + 1]
          : [sx - forced];
        candidates = candidates === null
          ? options
          : candidates.filter((value) => options.includes(value));
      }

      if (candidates === null) {
        candidates = parityValues[((rank % 2) + 2) % 2].slice();
      }

      const unique = [];
      const seen = new Set();
      const parity = ((rank % 2) + 2) % 2;
      for (const value of candidates) {
        if (value < -width || value > width) {
          continue;
        }
        if ((((value % 2) + 2) % 2) !== parity) {
          continue;
        }
        if (usedByRank[rank].has(value)) {
          continue;
        }
        if (!seen.has(value)) {
          seen.add(value);
          unique.push(value);
        }
      }

      const target = targetByIndex.has(index) ? targetByIndex.get(index) : 0;
      unique.sort((a, b) => {
        const targetDiff = Math.abs(a - target) - Math.abs(b - target);
        if (targetDiff !== 0) {
          return targetDiff;
        }
        const absDiff = Math.abs(a) - Math.abs(b);
        if (absDiff !== 0) {
          return absDiff;
        }
        return a - b;
      });
      return unique;
    }

    function locallyCompatible(index, x) {
      const node = nodes[index];

      for (const pred of node.preds) {
        const px = assigned[pred];
        if (px !== null) {
          const dx = x - px;
          if (Math.abs(dx) !== 1) {
            return false;
          }
          const forced = forcedEdgeDx.get(edgeKey(pred, index));
          if (forced !== undefined && dx !== forced) {
            return false;
          }
        }
      }
      for (const succ of node.succs) {
        const sx = assigned[succ];
        if (sx !== null) {
          const dx = sx - x;
          if (Math.abs(dx) !== 1) {
            return false;
          }
          const forced = forcedEdgeDx.get(edgeKey(index, succ));
          if (forced !== undefined && dx !== forced) {
            return false;
          }
        }
      }

      for (const pred of node.preds) {
        if (assigned[pred] !== null) {
          continue;
        }
        const predRank = nodes[pred].rank;
        const forced = forcedEdgeDx.get(edgeKey(pred, index));
        if (forced !== undefined) {
          const required = x - forced;
          if (usedByRank[predRank].has(required)) {
            return false;
          }
        } else {
          const optA = x - 1;
          const optB = x + 1;
          const canA = !usedByRank[predRank].has(optA);
          const canB = !usedByRank[predRank].has(optB);
          if (!canA && !canB) {
            return false;
          }
        }
      }

      for (const succ of node.succs) {
        if (assigned[succ] !== null) {
          continue;
        }
        const succRank = nodes[succ].rank;
        const forced = forcedEdgeDx.get(edgeKey(index, succ));
        if (forced !== undefined) {
          const required = x + forced;
          if (usedByRank[succRank].has(required)) {
            return false;
          }
        } else {
          const optA = x - 1;
          const optB = x + 1;
          const canA = !usedByRank[succRank].has(optA);
          const canB = !usedByRank[succRank].has(optB);
          if (!canA && !canB) {
            return false;
          }
        }
      }

      return true;
    }

    function chooseVariable() {
      let bestIndex = null;
      let bestValues = null;

      for (let rank = 0; rank <= maxRank; rank += 1) {
        const layer = rankOrder.get(rank) || [];
        for (const index of layer) {
          if (assigned[index] !== null) {
            continue;
          }

          const values = candidateValues(index).filter((value) =>
            locallyCompatible(index, value)
          );
          if (values.length === 0) {
            return {
              index,
              values,
            };
          }
          if (bestIndex === null || values.length < bestValues.length) {
            bestIndex = index;
            bestValues = values;
            if (values.length === 1) {
              return {
                index: bestIndex,
                values: bestValues,
              };
            }
          }
        }
      }

      if (bestIndex === null) {
        return null;
      }
      return {
        index: bestIndex,
        values: bestValues,
      };
    }

    let calls = 0;
    const maxCalls = 250000;

    function search() {
      calls += 1;
      if (calls > maxCalls) {
        return false;
      }

      const choice = chooseVariable();
      if (choice === null) {
        return true;
      }
      if (choice.values.length === 0) {
        return false;
      }

      for (const value of choice.values) {
        assign(choice.index, value);
        if (search()) {
          return true;
        }
        unassign(choice.index);
      }
      return false;
    }

    const minima = rankOrder.get(0);
    if (minima && minima.length === 1) {
      assign(minima[0], 0);
    }

    if (!search()) {
      return false;
    }

    for (const node of nodes) {
      node.drawX = assigned[node.index];
      node.drawY = node.rank;
    }
    return true;
  }

  function edgeKey(from, to) {
    return `${from},${to}`;
  }

  function bottomTailEdges(nodes) {
    const minima = [];
    for (const node of nodes) {
      if (node.preds.length === 0) {
        minima.push(node.index);
      }
    }
    if (minima.length !== 1) {
      return [];
    }

    const edges = [];
    const seen = new Set();
    let current = minima[0];
    while (!seen.has(current) && nodes[current].succs.length === 1) {
      seen.add(current);
      const next = nodes[current].succs[0];
      edges.push([current, next]);
      current = next;
    }
    return edges;
  }

  function topTailEdges(nodes) {
    const maxima = [];
    for (const node of nodes) {
      if (node.succs.length === 0) {
        maxima.push(node.index);
      }
    }
    if (maxima.length !== 1) {
      return [];
    }

    const edges = [];
    const seen = new Set();
    let current = maxima[0];
    while (!seen.has(current) && nodes[current].preds.length === 1) {
      seen.add(current);
      const prev = nodes[current].preds[0];
      edges.push([prev, current]);
      current = prev;
    }
    return edges;
  }

  function assignBarycenterCoordinates(nodes, maxRank, byRank) {
    const xPos = new Map();
    for (let rank = 0; rank <= maxRank; rank += 1) {
      const row = byRank.get(rank).slice();
      row.sort((a, b) => {
        const aPreds = nodes[a].preds;
        const bPreds = nodes[b].preds;

        const aCenter = barycenter(aPreds, xPos);
        const bCenter = barycenter(bPreds, xPos);
        if (aCenter !== bCenter) {
          return aCenter - bCenter;
        }

        const labelDiff = nodes[a].label - nodes[b].label;
        if (labelDiff !== 0) {
          return labelDiff;
        }
        return a - b;
      });

      const offset = (row.length - 1) / 2;
      for (let i = 0; i < row.length; i += 1) {
        xPos.set(row[i], i - offset);
      }
    }

    for (const node of nodes) {
      node.drawX = xPos.get(node.index) || 0;
      node.drawY = node.rank;
    }
  }

  function centerDrawCoordinates(nodes) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.drawX);
      maxX = Math.max(maxX, node.drawX);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return;
    }

    const offset = Math.round(-(minX + maxX) / 2);
    if (offset === 0) {
      return;
    }
    for (const node of nodes) {
      node.drawX += offset;
    }
  }

  function barycenter(preds, xPos) {
    if (preds.length === 0) {
      return 0;
    }
    let total = 0;
    let count = 0;
    for (const pred of preds) {
      if (xPos.has(pred)) {
        total += xPos.get(pred);
        count += 1;
      }
    }
    if (count === 0) {
      return 0;
    }
    return total / count;
  }

  function nearestWithParity(value, parity) {
    function adjust(candidate) {
      if ((((candidate % 2) + 2) % 2) === parity) {
        return candidate;
      }
      const down = candidate - 1;
      const up = candidate + 1;
      const downMatches = (((down % 2) + 2) % 2) === parity;
      const upMatches = (((up % 2) + 2) % 2) === parity;
      if (downMatches && upMatches) {
        return Math.abs(down - value) <= Math.abs(up - value) ? down : up;
      }
      if (downMatches) {
        return down;
      }
      return up;
    }

    const floorCandidate = adjust(Math.floor(value));
    const ceilCandidate = adjust(Math.ceil(value));
    return Math.abs(floorCandidate - value) <= Math.abs(ceilCandidate - value)
      ? floorCandidate
      : ceilCandidate;
  }

  function hasBit(mask, index) {
    return ((mask >>> index) & 1) === 1;
  }

  function setBit(mask, index) {
    return (mask | (1 << index)) >>> 0;
  }

  function clearBit(mask, index) {
    return (mask & ~(1 << index)) >>> 0;
  }

  function canAdd(mask, index, poset) {
    if (hasBit(mask, index)) {
      return false;
    }
    const node = poset.nodes[index];
    return node.preds.every((pred) => hasBit(mask, pred));
  }

  function canRemove(mask, index, poset) {
    if (!hasBit(mask, index)) {
      return false;
    }
    const node = poset.nodes[index];
    return node.succs.every((succ) => !hasBit(mask, succ));
  }

  /**
   * Toggle one element of a poset ideal.
   * If the element is minimal in the complement, it is added; if maximal in the
   * ideal, it is removed; otherwise the mask is unchanged.
   */
  function toggleNode(mask, index, poset) {
    if (canAdd(mask, index, poset)) {
      return setBit(mask, index);
    }
    if (canRemove(mask, index, poset)) {
      return clearBit(mask, index);
    }
    return mask;
  }

  function applyToggleSequence(mask, indices, poset) {
    let nextMask = mask;
    const changedIndices = [];
    for (const index of indices) {
      const toggled = toggleNode(nextMask, index, poset);
      if (toggled !== nextMask) {
        nextMask = toggled;
        changedIndices.push(index);
      }
    }
    return {
      mask: nextMask,
      changedIndices,
    };
  }

  /**
   * Toggle by simple root label i: sequentially apply single-element toggles to
   * all nodes carrying label i in canonical index order.
   */
  function toggleByLabel(mask, label, poset) {
    const indices = poset.labelToIndices.get(label) || [];
    return applyToggleSequence(mask, indices, poset);
  }

  function toggleByRank(mask, rank, poset) {
    const indices = poset.rankToIndices.get(rank) || [];
    return applyToggleSequence(mask, indices, poset);
  }

  /**
   * Fon-Der-Flaass action:
   * toggle ranks from top to bottom (highest rank down to lowest rank).
   */
  function fonDerFlaassAction(mask, poset) {
    let nextMask = mask;
    const steps = [];
    const changed = [];

    for (let rank = poset.rankMax; rank >= poset.rankMin; rank -= 1) {
      const step = toggleByRank(nextMask, rank, poset);
      steps.push({
        rank,
        beforeMask: nextMask,
        afterMask: step.mask,
        changedIndices: step.changedIndices,
      });
      nextMask = step.mask;
      changed.push(...step.changedIndices);
    }

    return {
      mask: nextMask,
      steps,
      changedIndices: [...new Set(changed)],
    };
  }

  /**
   * Apply a word in simple-root toggles (for example, a Coxeter element).
   * The input word is [i1, i2, ..., in] and denotes c = s_{i1}...s_{in};
   * toggles are executed right-to-left to model left action by c.
   */
  function applyCoxeterWord(mask, word, poset) {
    let nextMask = mask;
    const steps = [];
    const changed = [];

    for (let idx = word.length - 1; idx >= 0; idx -= 1) {
      const label = word[idx];
      const step = toggleByLabel(nextMask, label, poset);
      steps.push({
        label,
        wordPosition: idx,
        beforeMask: nextMask,
        afterMask: step.mask,
        changedIndices: step.changedIndices,
      });
      nextMask = step.mask;
      changed.push(...step.changedIndices);
    }

    return {
      mask: nextMask,
      steps,
      changedIndices: [...new Set(changed)],
    };
  }

  function topologicalOrder(mask, poset, chooser) {
    const remaining = new Set();
    for (const node of poset.nodes) {
      if (hasBit(mask, node.index)) {
        remaining.add(node.index);
      }
    }

    const order = [];
    while (remaining.size > 0) {
      const ready = [];
      for (const index of remaining) {
        const node = poset.nodes[index];
        if (node.preds.every((pred) => !remaining.has(pred))) {
          ready.push(index);
        }
      }
      if (ready.length === 0) {
        throw new Error("Failed to produce linear extension.");
      }

      let chosen = ready[0];
      if (chooser) {
        chosen = chooser(ready.slice(), {
          orderLength: order.length,
          mask,
          poset,
        });
      } else {
        for (const index of ready) {
          if (index < chosen) {
            chosen = index;
          }
        }
      }
      remaining.delete(chosen);
      order.push(chosen);
    }
    return order;
  }

  /**
   * Apply a simple reflection s_i to a weight in fundamental-weight coordinates.
   */
  function reflect(weight, label, cartan) {
    const i = label - 1;
    const c = weight[i];
    const out = [];
    for (let j = 0; j < weight.length; j += 1) {
      out.push(weight[j] - c * cartan[i][j]);
    }
    return out;
  }

  /**
   * Compute φ(I) by reading labels along a linear extension of I and applying
   * the corresponding reflection word to the highest weight ω_k.
   */
  function phi(mask, poset, orderOverride) {
    const order = orderOverride || topologicalOrder(mask, poset);
    if (!isLinearExtension(order, mask, poset)) {
      throw new Error("phi received an invalid linear extension.");
    }

    let weight = poset.highestWeight.slice();
    const labels = [];
    for (const index of order) {
      const label = poset.nodes[index].label;
      labels.push(label);
      weight = reflect(weight, label, poset.cartan);
    }

    return {
      weight,
      labels,
      order,
    };
  }

  function enumerateIdeals(poset) {
    const queue = [0];
    const seen = new Set([0]);

    for (let q = 0; q < queue.length; q += 1) {
      const mask = queue[q];
      for (const node of poset.nodes) {
        const next = toggleNode(mask, node.index, poset);
        if (next !== mask && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return queue;
  }

  /**
   * Validate label-structure assumptions:
   * 1) no cover edge joins two nodes with the same label,
   * 2) for each label i, toggling all i-labeled nodes is order-independent
   *    (checked as forward vs reverse order over all ideals).
   */
  function analyzeLabelStructure(poset, idealsInput) {
    const ideals = idealsInput || enumerateIdeals(poset);
    const labels = [];
    let coverCounterexample = null;
    let toggleCounterexample = null;

    for (let label = 1; label <= poset.n; label += 1) {
      const indices = poset.labelToIndices.get(label) || [];
      let coverViolation = null;
      let toggleViolation = null;

      for (const nodeIndex of indices) {
        const node = poset.nodes[nodeIndex];
        for (const predIndex of node.preds) {
          const pred = poset.nodes[predIndex];
          if (pred.label === label) {
            coverViolation = {
              predIndex,
              succIndex: node.index,
            };
            break;
          }
        }
        if (coverViolation) {
          break;
        }
      }

      if (indices.length > 1) {
        const forwardOrder = indices.slice();
        const reverseOrder = indices.slice().reverse();

        for (const mask of ideals) {
          const forwardMask = applyToggleSequence(mask, forwardOrder, poset).mask;
          const reverseMask = applyToggleSequence(mask, reverseOrder, poset).mask;
          if (forwardMask !== reverseMask) {
            toggleViolation = {
              idealMask: mask,
              forwardMask,
              reverseMask,
              forwardOrder,
              reverseOrder,
            };
            break;
          }
        }
      }

      if (coverViolation && !coverCounterexample) {
        coverCounterexample = {
          label,
          ...coverViolation,
        };
      }
      if (toggleViolation && !toggleCounterexample) {
        toggleCounterexample = {
          label,
          ...toggleViolation,
        };
      }

      labels.push({
        label,
        nodeCount: indices.length,
        coverPropertyPass: coverViolation === null,
        coverCounterexample: coverViolation,
        toggleOrderIndependent: toggleViolation === null,
        toggleCounterexample: toggleViolation,
      });
    }

    return {
      labels,
      idealsChecked: ideals.length,
      overall: {
        coverPropertyPass: coverCounterexample === null,
        toggleOrderIndependencePass: toggleCounterexample === null,
      },
      coverCounterexample,
      toggleCounterexample,
    };
  }

  /**
   * Sample multiple linear extensions for each ideal and confirm φ is
   * independent of the chosen extension.
   */
  function checkPhiExtensionIndependence(poset, idealsInput, options) {
    const cfg = options || {};
    const maxSamplesPerIdeal = Math.max(4, Number(cfg.maxSamplesPerIdeal || 8));
    const ideals = idealsInput || enumerateIdeals(poset);

    let counterexample = null;
    let idealsChecked = 0;
    let samplesChecked = 0;

    for (const mask of ideals) {
      const base = phi(mask, poset);
      const samples = sampleLinearExtensions(mask, poset, maxSamplesPerIdeal);

      for (const order of samples) {
        const witness = phi(mask, poset, order);
        samplesChecked += 1;
        if (!sameArray(base.weight, witness.weight)) {
          counterexample = {
            mask,
            baseOrder: base.order,
            baseWeight: base.weight,
            witnessOrder: witness.order,
            witnessWeight: witness.weight,
          };
          break;
        }
      }
      idealsChecked += 1;
      if (counterexample) {
        break;
      }
    }

    return {
      ran: true,
      pass: counterexample === null,
      maxSamplesPerIdeal,
      idealsChecked,
      samplesChecked,
      counterexample,
    };
  }

  function verifyExhaustively(poset, options) {
    const cfg = options || {};
    const ideals = enumerateIdeals(poset);
    const weights = new Map();
    let duplicateWeight = null;
    let equivarianceFailure = null;
    let outOfOrbitWeight = null;

    for (const mask of ideals) {
      const info = phi(mask, poset);
      const weightKey = info.weight.join(",");

      if (poset.knownWeightKeys && !poset.knownWeightKeys.has(weightKey) && !outOfOrbitWeight) {
        outOfOrbitWeight = {
          mask,
          weight: info.weight.slice(),
        };
      }

      if (weights.has(weightKey) && weights.get(weightKey) !== mask && !duplicateWeight) {
        duplicateWeight = {
          weight: info.weight,
          firstMask: weights.get(weightKey),
          secondMask: mask,
        };
      } else if (!weights.has(weightKey)) {
        weights.set(weightKey, mask);
      }

      for (let label = 1; label <= poset.n; label += 1) {
        const toggledMask = toggleByLabel(mask, label, poset).mask;
        const lhs = phi(toggledMask, poset).weight;
        const rhs = reflect(info.weight, label, poset.cartan);
        if (!sameArray(lhs, rhs) && !equivarianceFailure) {
          equivarianceFailure = {
            mask,
            label,
            lhs,
            rhs,
          };
        }
      }
    }

    const labelStructure = analyzeLabelStructure(poset, ideals);
    const shouldRunPhiCheck = cfg.enablePhiExtensionCheck === undefined
      ? poset.n <= 6
      : Boolean(cfg.enablePhiExtensionCheck);

    let phiExtensionIndependence;
    if (shouldRunPhiCheck) {
      phiExtensionIndependence = checkPhiExtensionIndependence(
        poset,
        ideals,
        cfg.phiExtensionOptions
      );
    } else {
      phiExtensionIndependence = {
        ran: false,
        pass: null,
        skippedReason: `Skipped for n=${poset.n}; enabled by default only for n <= 6.`,
      };
    }

    const countMatchesDimension = ideals.length === poset.expectedIdeals;
    const bijective = weights.size === ideals.length && duplicateWeight === null;
    const equivariant = equivarianceFailure === null;
    const inOrbit = outOfOrbitWeight === null;
    const phiPass = phiExtensionIndependence.ran ? phiExtensionIndependence.pass : true;
    const allChecksPass = countMatchesDimension
      && bijective
      && equivariant
      && inOrbit
      && labelStructure.overall.coverPropertyPass
      && labelStructure.overall.toggleOrderIndependencePass
      && phiPass;

    return {
      idealsCount: ideals.length,
      expectedCount: poset.expectedIdeals,
      distinctWeights: weights.size,
      countMatchesDimension,
      bijective,
      equivariant,
      inOrbit,
      duplicateWeight,
      equivarianceFailure,
      outOfOrbitWeight,
      labelStructure,
      phiExtensionIndependence,
      allChecksPass,
    };
  }

  function applyOrbitAction(mask, action, poset) {
    if (!action || typeof action.kind !== "string") {
      throw new Error("applyOrbitAction requires an action with a kind.");
    }
    if (action.kind === "fon-der-flaass") {
      return fonDerFlaassAction(mask, poset);
    }
    if (action.kind === "coxeter") {
      if (!Array.isArray(action.word)) {
        throw new Error("Coxeter action requires a word array.");
      }
      return applyCoxeterWord(mask, action.word, poset);
    }
    throw new Error(`Unknown action kind: ${action.kind}`);
  }

  function orbitFromMask(startMask, action, poset) {
    const masks = [startMask];
    const seen = new Set([startMask]);
    const steps = [];
    let current = startMask;
    let guard = 0;
    const guardCap = poset.expectedIdeals + 1;

    while (true) {
      const step = applyOrbitAction(current, action, poset);
      steps.push({
        fromMask: current,
        toMask: step.mask,
        changedIndices: step.changedIndices.slice(),
      });

      current = step.mask;
      if (current === startMask) {
        break;
      }
      if (seen.has(current)) {
        throw new Error("orbitFromMask detected a cycle that does not return to start.");
      }
      seen.add(current);
      masks.push(current);

      guard += 1;
      if (guard > guardCap) {
        throw new Error("orbitFromMask exceeded expected ideal count guard.");
      }
    }

    return {
      startMask,
      masks,
      steps,
      orbitLength: masks.length,
      fixedPointsInOrbit: masks.length === 1 ? 1 : 0,
    };
  }

  function idealStatistics(mask, poset) {
    const labelCounts = Array(poset.n).fill(0);
    let size = 0;
    let antichainSize = 0;

    for (const node of poset.nodes) {
      if (!hasBit(mask, node.index)) {
        continue;
      }
      size += 1;
      labelCounts[node.label - 1] += 1;

      if (node.succs.every((succ) => !hasBit(mask, succ))) {
        antichainSize += 1;
      }
    }

    return {
      size,
      labelCounts,
      antichainSize,
    };
  }

  function summarizeOrbit(masks, poset) {
    if (!Array.isArray(masks) || masks.length === 0) {
      throw new Error("summarizeOrbit requires a non-empty orbit mask list.");
    }

    const totalsByLabel = Array(poset.n).fill(0);
    let totalSize = 0;
    let totalAntichainSize = 0;

    for (const mask of masks) {
      const stats = idealStatistics(mask, poset);
      totalSize += stats.size;
      totalAntichainSize += stats.antichainSize;
      for (let i = 0; i < poset.n; i += 1) {
        totalsByLabel[i] += stats.labelCounts[i];
      }
    }

    const orbitLength = masks.length;
    return {
      orbitLength,
      avgSize: totalSize / orbitLength,
      avgAntichainSize: totalAntichainSize / orbitLength,
      avgLabelCounts: totalsByLabel.map((value) => value / orbitLength),
    };
  }

  function countActionFixedPoints(action, poset, idealsInput) {
    const ideals = idealsInput || enumerateIdeals(poset);
    let count = 0;
    const fixedMasks = [];

    for (const mask of ideals) {
      const nextMask = applyOrbitAction(mask, action, poset).mask;
      if (nextMask === mask) {
        count += 1;
        fixedMasks.push(mask);
      }
    }

    return {
      fixedPoints: count,
      idealsChecked: ideals.length,
      fixedMasks,
    };
  }

  function homomesyPredictions(poset) {
    const avgLabelCounts = poset.inverseCartanColumnNumbers.slice();
    const avgSize = avgLabelCounts.reduce((sum, value) => sum + value, 0);
    const avgAntichainSizeFDF = poset.nodes.length / poset.coxeterNumber;

    return {
      avgLabelCounts,
      avgSize,
      avgAntichainSizeFDF,
      source: {
        labelCounts: "(C^{-1})_{i,k}",
        avgSize: "sum_i (C^{-1})_{i,k}",
        avgAntichainSizeFDF: "|P|/h",
      },
    };
  }

  function typeAHomomesyPredictions(poset) {
    if (poset.type !== "A") {
      throw new Error("typeAHomomesyPredictions is only defined for type A.");
    }
    const n = poset.n;
    const k = poset.k;
    const avgLabelCounts = [];
    for (let i = 1; i <= n; i += 1) {
      const left = Math.min(i, k);
      const right = n + 1 - Math.max(i, k);
      avgLabelCounts.push((left * right) / (n + 1));
    }
    return {
      avgLabelCounts,
      avgSize: (k * (n + 1 - k)) / 2,
      avgAntichainSize: (k * (n + 1 - k)) / (n + 1),
    };
  }

  /**
   * Rank-generating polynomial M_P(q) = sum_{I in J(P)} q^{|I|}.
   * Coefficient m counts ideals of cardinality m.
   */
  function rankGeneratingPolynomial(poset, idealsInput) {
    const ideals = idealsInput || enumerateIdeals(poset);
    const coeffs = Array(poset.nodes.length + 1).fill(0);
    for (const mask of ideals) {
      coeffs[bitCount(mask)] += 1;
    }
    return trimPolynomial(coeffs);
  }

  /**
   * Paper I fixed-point specialization for Fon-Der-Flaass:
   * evaluate M_P(q) at q = exp(2πi * power / h), where h is the Coxeter number.
   */
  function cspFixedPointEvaluationFromRankGenerating(poset, power, idealsInput) {
    const ideals = idealsInput || enumerateIdeals(poset);
    const coefficients = rankGeneratingPolynomial(poset, ideals);
    const order = poset.coxeterNumber;
    const stepPower = Number.isInteger(power) ? power : 1;
    const normalizedPower = ((stepPower % order) + order) % order;
    const value = evaluatePolynomialAtRootOfUnity(coefficients, order, normalizedPower);
    const roundedReal = Math.round(value.real);
    const imagAbs = Math.abs(value.imag);
    const realResidual = Math.abs(value.real - roundedReal);
    const numericStable = imagAbs <= 1e-7 && realResidual <= 1e-7;

    return {
      fixedPoints: roundedReal,
      order,
      power: normalizedPower,
      coefficients: coefficients.slice(),
      idealsCount: ideals.length,
      gcdValue: value.gcdValue,
      rootOrder: value.rootOrder,
      unitPower: value.unitPower,
      evaluation: {
        real: value.real,
        imag: value.imag,
        roundedReal,
        imagAbs,
        realResidual,
        numericStable,
      },
    };
  }

  function predictedCspFixedPointsTypeA(poset, power) {
    return cspFixedPointEvaluationTypeA(poset, power).fixedPoints;
  }

  function cspFixedPointEvaluationTypeA(poset, power) {
    if (poset.type !== "A") {
      throw new Error("cspFixedPointEvaluationTypeA is only defined for type A.");
    }

    const order = poset.n + 1;
    const k = poset.k;
    const stepPower = Number.isInteger(power) ? power : 1;
    const normalizedPower = ((stepPower % order) + order) % order;
    const coeffs = gaussianBinomialCoefficients(order, k);
    const gcdValue = gcd(order, normalizedPower);
    const rootOrder = order / gcdValue;
    const divisible = (k % rootOrder) === 0;
    const quotientK = divisible ? (k / rootOrder) : null;
    const fixedPoints = cspFixedPointsClosedFormTypeA(order, k, normalizedPower);

    return {
      fixedPoints,
      order,
      power: normalizedPower,
      gaussianN: order,
      gaussianK: k,
      coefficients: coeffs.slice(),
      gcdValue,
      rootOrder,
      divisible,
      quotientK,
    };
  }

  function evaluatePolynomialAtRootOfUnity(coefficients, order, power) {
    const normalizedPower = ((power % order) + order) % order;
    if (normalizedPower === 0) {
      const total = coefficients.reduce((sum, coeff) => sum + coeff, 0);
      return {
        real: total,
        imag: 0,
        gcdValue: order,
        rootOrder: 1,
        unitPower: 0,
      };
    }

    const gcdValue = gcd(order, normalizedPower);
    const rootOrder = order / gcdValue;
    const unitPower = normalizedPower / gcdValue;
    const residues = Array(rootOrder).fill(0);

    for (let exponent = 0; exponent < coefficients.length; exponent += 1) {
      const coeff = coefficients[exponent] || 0;
      if (coeff === 0) {
        continue;
      }
      residues[exponent % rootOrder] += coeff;
    }

    let real = 0;
    let imag = 0;
    const angleUnit = (2 * Math.PI * unitPower) / rootOrder;
    for (let residue = 0; residue < residues.length; residue += 1) {
      const coeff = residues[residue];
      if (coeff === 0) {
        continue;
      }
      const angle = angleUnit * residue;
      real += coeff * Math.cos(angle);
      imag += coeff * Math.sin(angle);
    }

    return {
      real,
      imag,
      gcdValue,
      rootOrder,
      unitPower,
    };
  }

  function gaussianBinomialCoefficients(n, k) {
    if (!Number.isInteger(n) || !Number.isInteger(k)) {
      throw new Error("gaussianBinomialCoefficients requires integer n and k.");
    }
    if (k < 0 || k > n) {
      return [0];
    }

    const kk = Math.min(k, n - k);
    let row = Array(kk + 1).fill(null);
    row[0] = [1];

    for (let nn = 1; nn <= n; nn += 1) {
      const next = Array(kk + 1).fill(null);
      next[0] = [1];
      const upto = Math.min(nn, kk);
      for (let jj = 1; jj <= upto; jj += 1) {
        if (jj === nn) {
          next[jj] = [1];
          continue;
        }
        const left = row[jj] || [0];
        const right = row[jj - 1] || [0];
        next[jj] = addPolynomials(left, shiftPolynomial(right, nn - jj));
      }
      row = next;
    }

    return trimPolynomial((row[kk] || [0]).slice());
  }

  function cspFixedPointsClosedFormTypeA(order, k, power) {
    const normalized = ((power % order) + order) % order;
    const g = gcd(order, normalized);
    const rootOrder = order / g;
    if (rootOrder === 1) {
      return binomial(order, k);
    }
    if (k % rootOrder !== 0) {
      return 0;
    }
    return binomial(g, k / rootOrder);
  }

  function inverseCartanColumnFractions(cartan, k) {
    const n = cartan.length;
    const matrix = cartan.map((row) => row.map((value) => frac(value, 1)));
    const rhs = [];
    for (let i = 0; i < n; i += 1) {
      rhs.push(frac(i === k - 1 ? 1 : 0, 1));
    }

    for (let col = 0; col < n; col += 1) {
      let pivotRow = -1;
      for (let row = col; row < n; row += 1) {
        if (matrix[row][col].num !== 0) {
          pivotRow = row;
          break;
        }
      }
      if (pivotRow === -1) {
        throw new Error("Cartan matrix inversion failed: singular matrix.");
      }

      if (pivotRow !== col) {
        const tmpRow = matrix[col];
        matrix[col] = matrix[pivotRow];
        matrix[pivotRow] = tmpRow;

        const tmpVal = rhs[col];
        rhs[col] = rhs[pivotRow];
        rhs[pivotRow] = tmpVal;
      }

      const pivot = matrix[col][col];
      for (let j = col; j < n; j += 1) {
        matrix[col][j] = fracDiv(matrix[col][j], pivot);
      }
      rhs[col] = fracDiv(rhs[col], pivot);

      for (let row = 0; row < n; row += 1) {
        if (row === col) {
          continue;
        }
        const factor = matrix[row][col];
        if (factor.num === 0) {
          continue;
        }

        for (let j = col; j < n; j += 1) {
          matrix[row][j] = fracSub(matrix[row][j], fracMul(factor, matrix[col][j]));
        }
        rhs[row] = fracSub(rhs[row], fracMul(factor, rhs[col]));
      }
    }

    return rhs;
  }

  function frac(num, den) {
    if (den === 0) {
      throw new Error("Zero denominator in fraction arithmetic.");
    }

    let n = num;
    let d = den;
    if (d < 0) {
      n = -n;
      d = -d;
    }

    if (n === 0) {
      return { num: 0, den: 1 };
    }

    const g = gcd(Math.abs(n), Math.abs(d));
    return {
      num: n / g,
      den: d / g,
    };
  }

  function fracSub(a, b) {
    return frac(a.num * b.den - b.num * a.den, a.den * b.den);
  }

  function fracMul(a, b) {
    return frac(a.num * b.num, a.den * b.den);
  }

  function fracDiv(a, b) {
    return frac(a.num * b.den, a.den * b.num);
  }

  function fracToNumber(value) {
    return value.num / value.den;
  }

  function addPolynomials(a, b) {
    const size = Math.max(a.length, b.length);
    const out = Array(size).fill(0);
    for (let i = 0; i < size; i += 1) {
      out[i] = (a[i] || 0) + (b[i] || 0);
    }
    return trimPolynomial(out);
  }

  function shiftPolynomial(poly, amount) {
    if (amount <= 0) {
      return poly.slice();
    }
    const out = Array(poly.length + amount).fill(0);
    for (let i = 0; i < poly.length; i += 1) {
      out[i + amount] = poly[i];
    }
    return out;
  }

  function trimPolynomial(poly) {
    let end = poly.length;
    while (end > 1 && poly[end - 1] === 0) {
      end -= 1;
    }
    return poly.slice(0, end);
  }

  function bitCount(mask) {
    let x = mask >>> 0;
    let count = 0;
    while (x !== 0) {
      x &= (x - 1);
      count += 1;
    }
    return count;
  }

  function sampleLinearExtensions(mask, poset, maxSamples) {
    const samples = [];
    const seen = new Set();

    function tryAdd(order) {
      const key = order.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        samples.push(order);
      }
    }

    tryAdd(topologicalOrder(mask, poset));
    tryAdd(topologicalOrder(mask, poset, (ready) => chooseMaxIndex(ready)));
    tryAdd(topologicalOrder(mask, poset, (ready) => chooseMinLabel(ready, poset)));
    tryAdd(topologicalOrder(mask, poset, (ready) => chooseMaxLabel(ready, poset)));

    let attempt = 0;
    const attemptCap = maxSamples * 10;
    while (samples.length < maxSamples && attempt < attemptCap) {
      const typeSeed = poset.type.charCodeAt(0);
      const seed = ((mask + 1) * 2654435761
        + (attempt + 1) * 1013904223
        + poset.n * 97
        + poset.k * 193
        + typeSeed * 17) >>> 0;
      const rng = makeRng(seed);
      const order = topologicalOrder(mask, poset, (ready) => chooseRandom(ready, rng));
      tryAdd(order);
      attempt += 1;
    }

    return samples;
  }

  function chooseMaxIndex(ready) {
    let chosen = ready[0];
    for (const index of ready) {
      if (index > chosen) {
        chosen = index;
      }
    }
    return chosen;
  }

  function chooseMinLabel(ready, poset) {
    let chosen = ready[0];
    for (const index of ready) {
      const a = poset.nodes[index];
      const b = poset.nodes[chosen];
      if (a.label < b.label || (a.label === b.label && index < chosen)) {
        chosen = index;
      }
    }
    return chosen;
  }

  function chooseMaxLabel(ready, poset) {
    let chosen = ready[0];
    for (const index of ready) {
      const a = poset.nodes[index];
      const b = poset.nodes[chosen];
      if (a.label > b.label || (a.label === b.label && index > chosen)) {
        chosen = index;
      }
    }
    return chosen;
  }

  function chooseRandom(ready, rng) {
    const slot = Math.floor(rng() * ready.length);
    return ready[slot];
  }

  function makeRng(seed) {
    let state = seed >>> 0;
    if (state === 0) {
      state = 0x9e3779b9;
    }
    return function nextRandom() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function isLinearExtension(order, mask, poset) {
    const expected = new Set();
    for (const node of poset.nodes) {
      if (hasBit(mask, node.index)) {
        expected.add(node.index);
      }
    }
    if (order.length !== expected.size) {
      return false;
    }

    const position = new Map();
    for (let i = 0; i < order.length; i += 1) {
      const index = order[i];
      if (position.has(index) || !expected.has(index)) {
        return false;
      }
      position.set(index, i);
    }

    for (const index of order) {
      const node = poset.nodes[index];
      for (const pred of node.preds) {
        if (expected.has(pred) && position.get(pred) > position.get(index)) {
          return false;
        }
      }
    }
    return true;
  }

  function sameArray(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  function binomial(n, k) {
    const kk = Math.min(k, n - k);
    let value = 1;
    for (let i = 1; i <= kk; i += 1) {
      value = Math.round((value * (n - kk + i)) / i);
    }
    return value;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x || 1;
  }

  global.MinusculeCore = {
    supportedTypes,
    supportedRanks,
    minusculeWeights,
    isMinusculeTriple,
    buildMinusculePoset,
    buildTypeAPoset,
    representationMetadata,
    hasBit,
    setBit,
    clearBit,
    canAdd,
    canRemove,
    toggleNode,
    toggleByLabel,
    toggleByRank,
    fonDerFlaassAction,
    applyCoxeterWord,
    topologicalOrder,
    reflect,
    phi,
    enumerateIdeals,
    analyzeLabelStructure,
    checkPhiExtensionIndependence,
    verifyExhaustively,
    applyOrbitAction,
    orbitFromMask,
    idealStatistics,
    summarizeOrbit,
    countActionFixedPoints,
    homomesyPredictions,
    typeAHomomesyPredictions,
    rankGeneratingPolynomial,
    cspFixedPointEvaluationFromRankGenerating,
    predictedCspFixedPointsTypeA,
    cspFixedPointEvaluationTypeA,
    gaussianBinomialCoefficients,
    sameArray,
    binomial,
    gcd,
  };
})(window);
