const dataUrl = `../../data/school-census/2015/sc-2015-states.csv`;
let mainVizEl = d3.select('#main-visualization');
let tableEl = mainVizEl.append('table').classed('table table-striped table-fixed', true);
let theadEl = tableEl.append('thead');
let tbodyEl = tableEl.append('tbody');

const SORTABLE_TH_TEMPLATE = document
  .querySelector('#sortable-th-template')
  .innerHTML;

const SORT_ORDER_TYPES = {
  'true': 'ascending',
  'false': 'descending'
};

function create(data) {
  let columns = d3.keys(data[0]);

  let sort = {
    column: null,
    order: null
  };

  // head
  theadEl
    .append('tr')
    .selectAll('th')
    .data(columns)
    .enter()
    .append('th')
      .attr('data-column', col => col)
      .html(col => SORTABLE_TH_TEMPLATE.replace('{{column}}', col))
    .each((datum, index, nodes) => {
      let thEl = nodes[index];
      d3.select(thEl)
        .selectAll('.column-sort')
        .on('click', () => {
          // define qual a nova ordenação (campo e ordem)
          let previousSortColumn = sort.column;
          sort.column = datum;
          sort.order = sort.column === previousSortColumn ?
            (sort.order === null ?
              true :
              !sort.order)
            : true;

          // atualiza o ícone de sorting...
          // (a) da antiga coluna de ordenação
          d3.selectAll(thEl.closest('tr').querySelectorAll('th'))
            .classed(d3.values(SORT_ORDER_TYPES).join(' '), false);

          // (b) da atual coluna de ordenação
          d3.select(thEl)
            .classed(SORT_ORDER_TYPES[sort.order], true)
            .classed(SORT_ORDER_TYPES[!sort.order], false);

          // ordena os dados
          data.sort((rowA, rowB) => {
            let order = SORT_ORDER_TYPES[sort.order];
            return d3[order](rowA[sort.column], rowB[sort.column]);
          });

          update(data);
        });
    });
}

function update(data) {
  let columns = d3.keys(data[0]);

  // body
  tbodyEl.selectAll('tr').remove();
  let rows = tbodyEl
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

  let cells = rows
    .selectAll('td')
    .data(row => {
      return columns.map(col => ({ column: col, value: row[col] }));
    })
    .enter()
    .append('td')
      .text(d => d.value);
}

d3.csv(dataUrl)
  .get(data => {
    create(data);
    update(data);
  });
