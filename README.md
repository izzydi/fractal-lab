# Fractal Lab

**[▶ Open Fractal Lab](https://izzydi.github.io/fractal-lab/)**

Interactive maths and Python labs for Greek lower-secondary (Gymnasium) students. Each lab is a single web page that runs in any browser, with no installation or account. Students meet a fractal, work through the maths behind it, edit commented Python that draws it, and see the result straight away.

| # | Lab | What students build | Maths |
|---|---|---|---|
| 1 | [Koch snowflake](https://izzydi.github.io/koch-fractal/) · [source](https://github.com/izzydi/koch-fractal) | A 2D snowflake from a triangle | ÷ 3, 60° and √3, × 4 segments per level |
| 2 | [Menger sponge](https://izzydi.github.io/menger-sponge/) · [source](https://github.com/izzydi/menger-sponge) | A rotatable 3D sponge from a cube | 3 × 3 × 3 = 27, 27 − 7 = 20, volume as fractions |
| 3 | [Sierpinski triangle](https://izzydi.github.io/fractal-lab/sierpinski-triangle/) · [source](https://github.com/izzydi/fractal-lab/tree/main/sierpinski-triangle) | A triangle full of holes | Midpoints, ÷ 2, × 3 triangles, area × 3/4 |
| 4 | [Sierpinski tetrahedron](https://izzydi.github.io/fractal-lab/sierpinski-tetrahedron/) · [source](https://github.com/izzydi/fractal-lab/tree/main/sierpinski-tetrahedron) | A rotatable 3D tetrahedron | Midpoints in space, × 4 tetrahedra, volume × 1/2 |
| 5 | [Pythagoras tree](https://izzydi.github.io/fractal-lab/pythagoras-tree/) · [source](https://github.com/izzydi/fractal-lab/tree/main/pythagoras-tree) | A tree of squares | 90° rotation, 1² = a² + a², 2<sup>n+1</sup> − 1 squares |
| 6 | [Fractal tree](https://izzydi.github.io/fractal-lab/fractal-tree/) · [source](https://github.com/izzydi/fractal-lab/tree/main/fractal-tree) | A branching tree with angle and scale sliders | Sine and cosine, 90° ± angle, lengths × 0.7 |
| 7 | [Dragon curve](https://izzydi.github.io/fractal-lab/dragon-curve/) · [source](https://github.com/izzydi/fractal-lab/tree/main/dragon-curve) | A curve from folding a paper strip | Powers of 2, R/L turn rule, distance × √2 |

The numbering is a suggested order, but each lab stands on its own. The Sierpinski triangle is the gentlest start (midpoints only); labs 5–7 use the Pythagorean theorem, square roots and sine/cosine, so they suit the second and third year of Gymnasium. Every lab ends with a challenge and a worked solution.

Labs 1 and 2 live in their own repositories. Labs 3–7 live in this repository, one folder each, and share [`assets/`](assets) (styles, the Python editor and the 2D drawing code). Everything is published with GitHub Pages; edited code runs in the browser with [Pyodide](https://pyodide.org/).

## Στα ελληνικά

Διαδραστικά εργαστήρια μαθηματικών και Python για το Γυμνάσιο, το καθένα για μία διδακτική ώρα. Οι μαθητές γνωρίζουν ένα fractal, κατανοούν τα μαθηματικά του και τρέχουν Python απευθείας στον browser, χωρίς εγκατάσταση και χωρίς λογαριασμό.
