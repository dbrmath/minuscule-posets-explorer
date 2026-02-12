# Minuscule Posets Explorer (Types A, D, E)

This is a zero-dependency static app for minuscule posets in types `A`, `D`, and `E`.

Default startup parameters are `type = A`, `n = 4`, `k = 2`.

It visualizes:

- the minuscule poset `P` for the selected `(type, n, k)`,
- order ideals and single-node/root-label toggles,
- Fon-Der-Flaass action (rank toggles from top to bottom),
- user-defined Coxeter motion (any chosen ordering of simple reflections),
- full-orbit witness/animation for either action from the current ideal,
- orbit statistics (`|I|`, `I^i`, `|max(I)|`, fixed-point counts),
- observed-vs-predicted comparisons from the minuscule orbit papers,
- the bijection `phi: J(P) -> W . omega_k`,
- and equivariance `phi(t_i(I)) = s_i(phi(I))`.

## File structure

- `index.html`: app layout and controls, including orbit witness controls and the collapsible "Developer / Math Notes" section.
- `styles.css`: visual styling for panels, SVG diagram, reports, and developer notes.
- `core.js`: pure combinatorial/math core with no DOM access, including orbit extraction/statistics/prediction helpers.
- `ui.js`: UI state + rendering layer that calls `window.MinusculeCore`.
- `app.js`: tiny boot file that runs `MinusculeUI.init()` on `DOMContentLoaded`.

## Supported minuscule families

- Type `A_n` (`n = 2..8`): all `k = 1..n`.
- Type `D_n` (`n = 4..8`): `k = 1, n-1, n`.
- Type `E_6`: `k = 1, 6`.
- Type `E_7`: `k = 7`.

## Mathematical model

- In type `A`, the app uses the rectangle model
  `P_{n,k} = [k] x [n+1-k]` with label
  `label(row,col) = k - row + col`.
- In types `D` and `E`, the app constructs the minuscule poset from the
  oriented minuscule weight lattice (join-irreducibles of that distributive lattice).
- `phi(I)` is computed as a reflection word along a linear extension of `I`:
  `phi(I) = s_{i_1} ... s_{i_t}(omega_k)`.
- Reflections use Cartan data of the selected type in fundamental-weight coordinates:
  `s_i(mu) = mu - <mu, alpha_i^vee> alpha_i`.
- Root toggles are
  `t_i = product_{p label i} t_p`,
  implemented as sequential single-node toggles on all `i`-labeled nodes.
- Fon-Der-Flaass action is implemented as rank toggles from top rank to bottom rank.
- Coxeter motion is implemented as any user-specified permutation word in
  simple-root toggles.
  Equivariance identifies this with the corresponding Coxeter element
  `c = s_{i1}...s_{in}` on the weight side.

## Orbit witness + predictions

For either Fon-Der-Flaass action or a chosen Coxeter element, the app can animate
one full orbit from the current ideal and then return to the start.

The orbit report displays:

- orbit length and fixed points in the witnessed orbit,
- global fixed-point count under the chosen action (across all ideals),
- observed orbit averages of `|I|`, `I^i`, and `|max(I)|`,
- predicted values and observed-minus-predicted deltas.

Predictions used in the report:

- all supported types:
  - `avg(I^i) = (omega_k, omega_i) = (C^{-1})_{i,k}` (ADE normalization `(alpha_i, alpha_i)=2`),
  - `avg(|I|) = sum_i (C^{-1})_{i,k}`,
  - for Fon-Der-Flaass action: `avg(|max(I)|) = |P|/h`,
  - for Fon-Der-Flaass action: Paper I fixed points via
    `M_P(exp(2*pi*i*d/h))`, where `M_P(q) = sum_{I in J(P)} q^{|I|}`.
- type `A` additionally shows the closed-form specialization for
  `M_P(exp(2*pi*i*d/(n+1)))` together with the expanded q-binomial
  polynomial.

## Verification checks

`Run Exhaustive Verification` computes all ideals and checks:

1. cardinality: `|J(P)| = C(n+1, k)`,
2. bijectivity of `phi` on the finite set of ideals/weights,
3. equivariance `phi(t_i(I)) = s_i(phi(I))`,
4. cover-edge label property: no cover edge `p -> q` with `label(p) = label(q)`,
5. root-toggle order independence: forward vs reverse order over same-label toggles,
6. optional `phi` linear-extension independence (sampled; enabled by default for `n <= 6`).

Failures report the first concrete counterexample (ideal and witness data).

## Run

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

No build step or external dependencies are required.
