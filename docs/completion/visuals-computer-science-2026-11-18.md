# Visual aids: Computer Science 308 (report written 2026-11-18)

Nothing was committed, deployed or applied to production. The 55 SVGs were drawn by earlier work in this project (scripts in `D:\tmp\gen-cs-*`, outside the repo). They were NOT connected to any lesson until this step: 45 sat in `308/diagrams/` and 10 networking figures were still only in a scratch folder (copied in on 2026-11-18). This step connected all 55 to their lessons, wrote the declarations, the captions, the alt texts, the long descriptions and one "What to learn from this figure" text for each, using the labels and numbers drawn inside each figure.

## 1. Lessons audited (22 lessons with text; 13 received figures)
Figures: r00-sql-database-query (5), r02-database-concepts (4), r03-pandas-series-dataframe (6), r04-sql-ddl-dml (4), r05-stack (5), r06-queue (3), r07-pandas-ii (3), r09-matplotlib (7), r10-computer-networks (3), r11-searching (4), r12-computer-networks-web (3), r13-sorting (4), r19-computer-networks (4).
Lessons with no figure (no suitable concept found, or the topic is a list of commands or a program): r01-exceptions-files, r08-sql-ii, r14-societal-impacts-ip-cyber-ewaste, r15-understanding-data-statistics, r16-database-concepts-relational-algebra, r17-project-based-learning, r18-structured-query-language, r20-data-communication, r21-security-aspects.

## 2. Diagrams connected (55)

| Lesson | Figure key | Title | What the student learns |
|---|---|---|---|
| r00-sql-database-query | aggregates-null | COUNT(*) and COUNT(Qty) differ when a value is NULL | COUNT(*) counts rows, but COUNT(column), SUM and AVG ignore NULL. The average divides by the 6 values that exist (30 / 6 = 5), not by all 7 rows. |
| r00-sql-database-query | sum-having-order | From rows to groups: SUM, HAVING and ORDER BY on SALES | The query works in stages: multiply per row, group and add per Item, drop groups with HAVING, then sort. NULL * Price is NULL, so SUM skips that row and Pen totals only… |
| r00-sql-database-query | where-group-having | WHERE removes rows before grouping, HAVING removes groups after | WHERE works on single rows before any grouping; HAVING works on whole groups after they are counted. Here WHERE drops 3 rows first, and then HAVING drops 2 of the 3 grou… |
| r00-sql-database-query | product-join-pairs | All 12 pairs of STAFF and DEPT, and the 3 that survive a join | A Cartesian product pairs everything with everything (4 rows x 3 rows = 12). A join keeps only the pairs where the common column matches, here 3 of the 12. |
| r00-sql-database-query | equi-natural-join | Equi-join keeps both DeptNo columns, natural join keeps one | Both joins return the same 3 rows. The only difference is the columns: the equi-join shows the matching column from each table (5 columns), the natural join shows it onc… |
| r02-database-concepts | relational-terms | The STUDENT relation with its relational terms labelled | Relation = table, attribute = column, tuple = row. Degree counts columns (4) and cardinality counts rows (5); do not swap them. |
| r02-database-concepts | keys | Candidate, primary, alternate and foreign keys in EMP and DEPT | Every candidate key could identify a row; the designer picks one as the primary key and the others become alternate keys. A foreign key points to a primary key in anothe… |
| r02-database-concepts | select-project | Selection picks rows, projection picks columns | Selection is a horizontal cut (some rows, all columns). Projection is a vertical cut (some columns, all rows) and removes duplicate rows from the result, so 5 cities bec… |
| r02-database-concepts | product-join | Cartesian product of STUDENT and MARKS, and the rows a join keeps | In a Cartesian product the degrees add (2 + 2 = 4) and the cardinalities multiply (3 x 3 = 9). Choosing only the rows where the Roll numbers match turns the product into… |
| r03-pandas-series-dataframe | series-anatomy | A Series is an index plus values | A Series has two parts, labels (index) and values, and every value has an automatic position as well. You can reach the same element by label (s["b"]) or by position (s.… |
| r03-pandas-series-dataframe | dataframe-axes | Rows are axis 0 and columns are axis 1 | axis=0 means "down the rows" and axis=1 means "across the columns". For drop() the default is rows, so you must write axis=1 to remove a column. |
| r03-pandas-series-dataframe | loc-vs-iloc | loc uses labels and includes the end; iloc uses positions and excludes the end | Label slices with loc include the end label (3 rows for 10:12), while position slices with iloc stop before the end position (2 rows for 0:2). |
| r03-pandas-series-dataframe | boolean-filter | Boolean indexing keeps rows where every condition is True | A Boolean mask is a column of True and False; only rows with True survive. With & both conditions must be True, and each condition must be in its own brackets. |
| r03-pandas-series-dataframe | merge-inner-left-outer | merge: inner, left and outer give different rows | inner keeps only keys present in both tables, left keeps every row of the left table, outer keeps every key from either table. Missing values appear as NaN. |
| r03-pandas-series-dataframe | concat-axis | concat stacks (axis=0) or sits side by side (axis=1) without matching keys | concat only glues tables together; it never checks key values. Use merge when rows must be matched on a key, and ignore_index=True when you want fresh row labels. |
| r04-sql-ddl-dml | ddl-dml-classes | DDL, DML and DQL: what each group of SQL commands changes | Ask what a command touches. Structure (tables, columns) is DDL, rows are DML, and only reading is DQL. |
| r04-sql-ddl-dml | drop-vs-delete | DELETE empties a table, DROP removes structure | DELETE removes rows but the table stays. DROP removes structure: DROP COLUMN one column, DROP TABLE the whole table with its rows. |
| r04-sql-ddl-dml | update-delete | UPDATE and DELETE with WHERE on the PRODUCT table | The WHERE clause decides which rows change. Without it UPDATE or DELETE would act on every row, and a NULL in a condition has to be tested with IS NULL. |
| r04-sql-ddl-dml | where-tests | Which PRODUCT rows pass LIKE, BETWEEN and IS NULL | LIKE "_o%" means any first letter, then o, then anything. BETWEEN includes both end values, and a NULL is found only with IS NULL, never with = NULL. |
| r05-stack | stack-structure | A stack is open at one end only (LIFO) | Everything happens at the top: push adds there and pop removes from there. That is why the last item in is the first one out. |
| r05-stack | stack-trace-list | Tracing push and pop on a list-based stack | The list end is the top. Each push appends at the end and each pop removes the last item, so after a pop the previous item becomes the top again. |
| r05-stack | stack-overflow-underflow | Overflow when full, underflow when empty | Overflow is pushing onto a full stack and underflow is popping from an empty one. A Python list has no fixed size, so the size 4 is only an illustration, but popping an… |
| r05-stack | infix-postfix | Converting an infix expression to postfix with an operator stack | Operands go to the output at once. An operator waits on the stack until an operator of lower or equal precedence arrives, and a closing bracket pops everything back to i… |
| r05-stack | postfix-eval | Evaluating a postfix expression with a stack | Push operands; for an operator pop twice (the first pop is the right operand B, the second is A), compute A op B and push the result back. One value left at the end is t… |
| r06-queue | queue-structure | A queue has a front and a rear (FIFO) | New items always join at the rear and leave from the front, so the first item in is the first out. |
| r06-queue | queue-trace | Tracing enqueue and dequeue on a list-based queue | enqueue is append() at the end of the list and dequeue is pop(0) at the start. The front moves forward each time something is removed. |
| r06-queue | deque-trace | Tracing a deque: insert and remove at both ends | A deque lets you add and remove at either end. For every statement write the list and mark which end changed, exactly as the exam trace asks. |
| r07-pandas-ii | quartiles-number-line | Quartiles and the IQR on a number line | The three quartiles split the sorted data into four equal parts, and the IQR (Q3 - Q1) measures the spread of the middle half. Q1 is 4.5 because pandas interpolates betw… |
| r07-pandas-ii | groupby-split-apply-combine | groupby: split, apply, combine | groupby works in three steps: split into groups, apply a function to each, combine the answers. The group keys become the index of the result, sorted in ascending order. |
| r07-pandas-ii | pivot-table | pivot_table aggregates repeated pairs; pivot would fail | pivot only rearranges and needs each (row, column) pair to be unique. pivot_table also aggregates, so repeated pairs such as (N, pen) are added together. |
| r09-matplotlib | figure-anatomy | Parts of a Matplotlib figure and the command for each | Each visible part of a chart has its own pyplot function. The legend only appears if the plot call has a label=. |
| r09-matplotlib | bar-and-barh | bar draws vertical bars, barh horizontal bars | Use a bar graph to compare separate categories. bar puts the categories on the x axis and barh on the y axis, and in both the bar length shows the value. |
| r09-matplotlib | histogram-bin-edges | A value on a bin edge goes into the bin on its right | Bins are half open, [a, b): the left edge is included and the right edge is not. Only the very last bin includes both edges. |
| r09-matplotlib | histogram-polygon | A histogram and its frequency polygon | In a histogram the bars touch because the classes are continuous. The frequency polygon is the line through the middle of the top of each bar, closed to zero at both end… |
| r09-matplotlib | pie-wedges | Each pie wedge is value / total x 360 degrees | The size of a wedge is its share of the total. Multiply the share by 360 to get the angle; the angles always add to 360. |
| r09-matplotlib | boxplot-parts | Reading a box plot: box, median, whiskers and outlier | The box spans Q1 to Q3 with the median inside; whiskers reach the furthest values within 1.5 x IQR of the box, and anything beyond is plotted as an outlier. |
| r09-matplotlib | scatter-patterns | Scatter plots show whether two variables are related | plt.scatter marks each (x, y) pair as a separate dot. The overall direction of the cloud shows whether the variables rise together, move opposite ways, or are unrelated. |
| r10-computer-networks | devices-in-place | Where each network device sits | Inside one network a switch passes data to the right computer; between networks a router chooses the path; a modem connects to the ISP and a gateway translates between d… |
| r10-computer-networks | topologies-bus-star-ring | Bus, star and ring topologies and their failure points | A topology is the layout of the links. Learn each one with its weak point: the backbone for a bus, the central device for a star, and any single break for a simple ring. |
| r10-computer-networks | topologies-tree-mesh | Tree and mesh topologies | A tree is stars joined in layers, so its weak point is the top. A mesh is very reliable because there are many paths, but it needs many links. |
| r11-searching | linear-trace | Linear search step by step | Linear search checks from the start until it finds the key or runs out of elements. A missing key costs n comparisons. |
| r11-searching | binary-trace | Binary search on a sorted list | Each comparison with the middle element throws away half of the remaining list. It only works if the list is sorted. |
| r11-searching | search-comparisons | Worst-case comparisons: linear against binary | Linear search grows in step with n, but binary search grows by only one for every doubling, which is why it wins on big sorted lists. |
| r11-searching | hash-tables | Collision resolution: linear probing and chaining | A collision happens when two keys give the same slot. Linear probing moves to the next free slot; chaining keeps a list in the slot. A search must follow the same path a… |
| r12-computer-networks-web | area-rings | PAN, LAN, MAN and WAN as growing rings | Networks are named by the area they cover, from a personal space to the whole world. Remember the order PAN < LAN < MAN < WAN; a city-wide network is a MAN, not a LAN. |
| r12-computer-networks-web | url-anatomy | The parts of a URL | A URL is the address of one resource: how to ask (protocol), who to ask (domain name) and what to ask for (path). |
| r12-computer-networks-web | web-page-request | What happens when you open a web page | The browser is the client and the web server is the server. DNS first turns the name into an IP address; only then can the browser ask the server for the page. |
| r13-sorting | bubble-passes | Bubble sort pass by pass | After each pass the largest unsorted value has bubbled to the end. If a whole pass makes no swap the list is already sorted, so a flag lets the algorithm stop early. |
| r13-sorting | selection-passes | Selection sort pass by pass | Selection sort scans the unsorted part for the minimum and puts it in the next place. It always makes n(n-1)/2 comparisons, however the data is arranged. |
| r13-sorting | insertion-passes | Insertion sort pass by pass | The left part is always sorted; each new key is slid left past larger elements until it fits. The work depends on how out of order the list is. |
| r13-sorting | sorting-counts | Best and worst case counts for the three sorts | Flagged bubble sort and insertion sort do very little on sorted data, but selection sort makes the same 10 comparisons whatever the order. |
| r19-computer-networks | mesh-link-count | Links in a full mesh: n(n - 1) / 2 | Each of the n nodes links to n - 1 others, but a link joins two nodes, so divide by 2: links = n(n - 1) / 2. Doubling the nodes more than doubles the cost. |
| r19-computer-networks | address-anatomy | Anatomy of an IPv4 address and a MAC address | An IPv4 address is 32 bits written as four numbers 0 to 255; a MAC address is 48 bits written as six hexadecimal pairs. The IP address is logical and can change; the MAC… |
| r19-computer-networks | dns-lookup | How DNS finds the IP address of a domain | DNS is a chain of questions that gets more specific each time (root, then top-level domain, then the domain's own server). The answer is cached afterwards so the next lo… |
| r19-computer-networks | hub-vs-switch | A hub copies to every port, a switch forwards to one | A hub repeats data to every other port, which wastes bandwidth and lets everyone see it. A switch learns MAC addresses and forwards each frame to the correct port only. |

## 3. Comparison tables added
None. The lessons already had 119 tables and no new table was needed.

## 4. Placement decisions
- Each figure sits straight after the block that teaches or works the example it shows (for example the sorting traces sit after the dry-run tables; the SQL join figures after the STAFF and DEPT worked problem).
- r10, r12 and r19 are three lessons on networks with overlapping content. Each of the ten networking figures was put in the one lesson where it fits best; no figure appears twice.
- Where a figure shows a table the lesson already prints, it was kept only if it adds the step-by-step working (traces, stack contents, pass-by-pass lists).

## 5. Needs subject-expert review (9)
1. r07 quartiles-number-line: Q1 = 4.5 uses pandas' interpolation. A textbook "median of the lower half" method gives 4 for the same data; check which one the CUET answer key expects.
2. r09 boxplot-parts: the 1.5 x IQR whisker rule and the quartile method used (same interpolation as pandas).
3. r09 histogram-bin-edges: the half-open bin rule [a, b) with the last bin closed.
4. r10 / r12 / r19 devices-in-place and hub-vs-switch: simplified roles of repeater, hub, switch, router, modem and gateway.
5. r19 dns-lookup: the root, TLD and authoritative chain is the standard teaching version; real resolvers cache and may skip steps.
6. r12 web-page-request: the address 192.0.2.10 is a documentation address, used only as an example.
7. r19 address-anatomy: the MAC address split into manufacturer (OUI) and serial parts.
8. r11 hash-tables: only the remainder method h(key) = key % 10 and one probing rule; check it matches the lesson's expected rule.
9. r05 infix-postfix: the steps for operators of equal precedence; the lesson's own wording applies.

## 6. Figures checked by recomputation
Step counts in the bubble, selection and insertion traces, the binary-search steps, the postfix evaluation (result 37) and the sorting counts table were recomputed by hand while writing the descriptions. One mistake was found and fixed: the infix-to-postfix description named the wrong expression (it converts (A+B)*C-D/E to AB+C*DE/-).

## Validation
`content-validate --exam CUET_UG --paper 308`: 44 of 44 packs valid. Imported into the local database (55 diagram records, all linked to lesson blocks, all with alt text). A second import changed nothing except the one corrected description. Rendered in a browser at 390, 820 and 1440 pixel widths with no broken figure. At 390 pixels the pass-by-pass tables and trace figures have small text, though they are readable; zooming is not available because the screens are frozen.
