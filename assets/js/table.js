const SORT_ORDER_TYPES = {
  'true': 'ascending',
  'false': 'descending'
};

class Table {
  constructor({ container, searchInput, statistics, pagination,
    headerTemplate, columns }) {
    // seleciona o elemento container e o template do cabeçalho
    this.containerEl = d3.select(container);
    this.searchEl = d3.select(searchInput);
    this.statisticsEl = this.containerEl.select(statistics);
    this.paginationEl = this.containerEl.select(pagination);
    this.headerTemplate = d3.select(headerTemplate).html();

    // se o container ou o template ou o campo de busca não forem encontrados,
    // não tem como montar a tabela
    if (!this.containerEl) {
      throw new Error(`Elemento container ${container} não
        foi encontrado na página`);
    }
    if (!this.headerTemplate) {
      throw new Error(`Elemento com o template da célula de cabeçalho
        ${headerTemplate} não foi encontrado na página`);
    }

    this.rowsPerPage = 10;
    this.columns = columns;
    this.data = [];
    this.allData = [];

    this.filterConfig = {
      query: ''
    };
    this.sortConfig = {
      column: null,
      order: null
    };
    this.pageConfig = {
      page: -1
    };

    this.searchEl.on('keyup', () => {
      // filtra dos dados
      this.filterData(d3.event.currentTarget.value);
      // mostra a primeira página
      this.paginateData(0);
      location.hash = '#1';
      // recarrega as linhas da tabela
      this.createBody();
    });
  }

  // carrega os dados da tabela a partir de um arquivo CSV
  // cujo caminho foi passado por parâmetro
  loadFromCSV(path) {
    d3.csv(path)
      .get(data => {
        // assim que conseguir os dados, atribui-os para o
        // membro data...
        this.data = data;
        // transforma os dados de acordo com a configuração das colunas
        this.data = this.transformData();
        this.columns = this.processColumns();
        // gera uma cópia de todos os dados, já transformados
        this.allData = this.data.slice(0);
        // ...e cria a tabela
        this.createTable();
        // ajusta a largura das colunas e a qtde ideal de linhas por página
        this.determineColumnWidths();
        // mostra apenas a primeira página
        this.paginateData(0);
        // reconstrói o corpo da tabela mostrando apenas página 1
        this.createBody();
        // configura a seção de "estatísticas"
        this.configureStatistics();
      });
  }

  // transforma os dados, convertendo-os de strings (CSV) para seus devidos
  // tipos, de acordo com os metadados das colunas
  transformData() {
    return this.data.map(row => {
       return this.columns.reduce((prev, curr) => {
         let value = row[curr.originalName];
         prev[curr.originalName] = curr.transform(value);
         return prev;
       }, {});
    });
  }

  // faz eventuais processamentos nos dados das colunas como, por exemplo,
  // determinar qual é o maior valor, os valores distintos etc.
  processColumns() {
    return this.columns.map(col => {
      let columnData = this.data.map(d => d[col.originalName]);
      return col.processor.reduce((prev, curr) =>
        curr.apply(this, [prev, columnData]), col)
      }
    );
  }

  // cria a tabela usando os dados em this.data
  createTable() {
    // cria uma <aside> para tooltips
    this.tooltipEl = this.containerEl
      .append('aside')
      .classed('tooltip', true);

    // cria o elemento principal <table> e coloca as classes
    // do bootstrap 'table' e 'table-striped'
    this.tableEl = this.containerEl
      .insert('table', ':first-child')
      .classed('table table-striped', true);

    // cria os elementos <thead> e <tbody> devidamente
    // preenchidos com o cabeçalho e as linhas de dados, respec.
    this.theadEl = this.createHeader();
    this.tbodyEl = this.createBody();
  }

  // cria o elemento <thead> com a linha do cabeçalho
  createHeader() {
    return this.tableEl.append('thead')
      .append('tr')
      .selectAll('th')
      .data(this.columns)
      .enter()
      // coloca um <th> para cada coluna
      .append('th')
        // usa o template e o "recheia" com o nome da coluna
        .html(col => this.headerTemplate.replace('{{column}}', col.label))
        .attr('class', col => col.cl)
      // percorrre cada <th> inserido para colocar evento de clique de ordenação
      .each((datum, index, nodes) => {
        let thEl = nodes[index];
        d3.select(thEl)
          .selectAll('.column-sort')
          .on('click', () => {
            // define qual a nova ordenação (campo e ordem)
            let previousSortColumn = this.sortConfig.column;
            let sortConfig = {
              column: datum.originalName,
              order: this.sortConfig.column === previousSortColumn ?
                (this.sortConfig.order === null ?
                  true :
                  !this.sortConfig.order)
                : true,
              thEl: thEl
            }

            // efetivamente ordena
            this.sortData(sortConfig);
            // monta a primeira página
            this.paginateData(0);
            location.hash = '#1';
            // recarrega as linhas da tabela
            this.createBody();
          });
      });
  }

  // cria o elemento <tbody> com uma linha para cada entrada de dados
  createBody() {
    this.tableEl.select('tbody').remove()
    let tbodyEl = this.tableEl.append('tbody');

    // cria uma linha para cada linha de dados
    let rows = tbodyEl
      .selectAll('tr')
      .data(this.pageConfig.page === -1 ? this.data : this.paginatedData)
      .enter()
      .append('tr');

    // cria uma célula para cada coluna, em cada linha
    let cells = rows
      .selectAll('td')
      .data(row => {
        // retorna um "dado" para cada célula desta linha
        return this.columns.map(col => {
          return {
            column: col,
            originalValue: row[col.originalName],
            value: row[col.originalName],
            row: row
          };
        });
      })
      .enter()
      .append('td')
        .html(function(col) {
          let table = this;
          return col.column.format.reduce((prev, curr) => {
            return {
              value: curr.apply(table, [prev.value, prev.row]),
              row: prev.row
            };
          }, { value: col.value, row: col.row })
            .value
        }.bind(this))
        .attr('class', col => col.column.cl)
        .filter('.numeric-column')
          .each((d, i, nodes) => {
            let maxValue = d.column.maxValue;
            let cellValue = d.originalValue || 0;
            let tdEl = d3.select(nodes[i]);
            let miniBarEl = tdEl
              .append('span')
              .classed('mini-bar', true)
              .style('width', `${(cellValue/maxValue)*100}%`);
            tdEl
              .append('aside')
              .classed('ttip', true);
            tdEl.on('mouseover', (d, i, n) => {
              let ttipEl = tdEl.select('.ttip');
                // this.tooltipEl.transition()
                ttipEl.transition()
                  .duration(100)
                  .delay(350)
                  .style('opacity', 0.9)
                  .style('transform', 'translate3d(0, 0, 0)');
                ttipEl
                  .text(`${((cellValue/maxValue)*100).toFixed(2)}%`)
              })
              .on('mouseout', (d, i, n) => {
                let ttipEl = tdEl.select('.ttip');
                ttipEl.transition()
                  .duration(100)
                  .style('opacity', 0)
                  .style('transform', 'translate3d(1em, 0, 0)');
              });
          });

    return tbodyEl;
  }

  // ordena os dados de acordo com a configuração (coluna, ordem) desejada
  sortData(sortConfig) {
    // atualiza o ícone de sorting...
    // (a) da antiga coluna de ordenação
    d3.selectAll(sortConfig.thEl.closest('tr').querySelectorAll('th'))
      .classed(d3.values(SORT_ORDER_TYPES).join(' '), false);

    // (b) da atual coluna de ordenação
    d3.select(sortConfig.thEl)
      .classed(SORT_ORDER_TYPES[sortConfig.order], true)
      .classed(SORT_ORDER_TYPES[!sortConfig.order], false);

    // ordena os dados
    this.data.sort((rowA, rowB) => {
      let order = SORT_ORDER_TYPES[sortConfig.order];
      return d3[order](rowA[sortConfig.column], rowB[sortConfig.column]);
    });

    // atualiza o texto sobre como está a ordenação na parte de estatísticas
    this.statisticsEl.select('.sort-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template.replace(
          '{{column}}',
          this.columns.find(c => c.originalName === sortConfig.column).label
        )
      )
      .style('visibility', () => sortConfig.column === null ? 'hidden' : 'visible');

    this.sortConfig = sortConfig;
  }

  // filtra os dados de acordo com o critério de busca desejado
  filterData(query) {
    query = query ? query.trim() : '';
    let emptyQuery = query === '';
    this.filterConfig = {
      query: query,
      in: this.allData.filter(
        datum => emptyQuery || d3.values(datum)
          .some(v => v.toString().toLowerCase().indexOf(query.toLowerCase()) !== -1)
      )
    };

    // atualiza o texto sobre como está o filtro na parte de estatísticas
    this.statisticsEl.select('.filter-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template
          .replace('{{query}}', query)
          .replace('{{qty}}', this.filterConfig.in.length))
       .classed('empty',emptyQuery);

    this.data = this.filterConfig.in;
  }

  // mostra apenas uma página de dados
  paginateData(page) {
    let totalPages = Math.ceil(this.allData.length / this.rowsPerPage);

    this.pageConfig = {
      page: page,
      first: this.rowsPerPage * page,      // início da página atual
      last: Math.min(this.allData.length,  // último registro
        this.rowsPerPage * (page + 1))     // fim da página atual
    };

    this.paginatedData = this.data.slice(
      this.pageConfig.first, this.pageConfig.last);

    // atualiza os elementos para refletirem a nova configuração das páginas
    let pagesData = [-1, -30, -2, -1, 0, 1, 2, 30, 1]
      .map(p => this.pageConfig.page + p)
      .filter((p, i, arr) => p >= 0 && p < totalPages || i === 0 || i === arr.length - 1);
    let pageLinks = this.paginationEl.selectAll('li').data(pagesData);

    let t = d3.transition()
      .duration(750)
      .ease(d3.easeElasticOut);

    // exiting elements
    let exiting = pageLinks.exit();
    exiting
      .style('position', 'absolute')
      .transition(t)
        .ease(d3.easeLinear)
        .style('opacity', 0)
        .style('transform', 'scale(0.1)')
        .remove();

    // updating elements
    pageLinks
      .classed('active', d => d === this.pageConfig.page)
      .classed('disabled', d => d < 0 || d >= totalPages)
      .select('a')
        .attr('href', d => `#${d+1}`)
        .html((d, i) => {
          switch (i) {
            case 0: return '<span aria-hidden="true">&laquo;</span>';
            case pagesData.length - 1: return '<span aria-hidden="true">&raquo;</span>';
            default: return d+1;
          }
        });

    // entering elements
    let entering = pageLinks.enter();
    entering.append('li')
      .style('transform', 'scale(0.1)')
      .style('opacity', '0')
      .classed('active', d => d === this.pageConfig.page)
      .append('a')
        .attr('href', d => `#${d+1}`)
        .classed('page-link', true)
        .html((d, i) => {
          switch (i) {
            case 0: return '<span aria-hidden="true">&laquo;</span>';
            case pagesData.length - 1: return '<span aria-hidden="true">&raquo;</span>';
            default: return d+1;
          }
        })
        .on('click', (d, i) => {
          let totalPages = Math.ceil(this.allData.length / this.rowsPerPage);
          if (d < 0 || d > totalPages - 1) {
            d3.event.preventDefault();
            return;
          }
          // foi necessário fazer a nova paginação apenas no próximo tick
          // porque senão o navegador navegava para o hash fragment da nova
          // href do botão
          setTimeout(() => {
            // faz a paginação
            this.paginateData(d);
            // recria o corpo da tabela
            this.createBody();
          }, 0);
        })
    entering.selectAll('li:first-child, li:last-child')
      .classed('disabled', d => d < 0 || d >= totalPages)
      .select('a')
        .attr('aria-label', (_, i) => i === 0 ? 'Previous' : 'Next')
        .attr('rel', (_, i) => i === 0 ? 'prev' : 'next')
    entering.selectAll('li').transition(t)
      .style('transform', 'scale(1)')
      .style('transform', 'scale(1)')
      .style('opacity', '1');


    // atualiza o texto sobre como está o filtro na parte de estatísticas
    this.statisticsEl.select('.page-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template
          .replace('{{page}}', this.pageConfig.page + 1)
          .replace('{{totalPages}}', totalPages)
          .replace('{{first}}', this.pageConfig.first + 1)
          .replace('{{last}}', this.pageConfig.last));
  }

  // configura a parte de "estatísticas" da tabela (parte de baixo da página)
  configureStatistics() {
    // evento do botão de "pin" da seção de estatísticas
    this.statisticsEl.select('.pin').on('click', (_d, i, nodes) => {
      let showing = this.statisticsEl.node().classList.toggle('showing');
      nodes[i].classList.toggle('active', showing);
    });
  }

  determineRowsPerPage() {
    let availableHeight = window.innerHeight -
      // parte de cima da página
      (this.containerEl.node().getClientRects()[0].top +
      this.containerEl.select('.statistics').node().getClientRects()[0].height);
    let rowHeights = this.tableEl
      .selectAll('tr')
      .nodes()
      .map(n => n.getClientRects()[0].height);
    let rowHeightsFreq = rowHeights.reduce((prev, curr) => {
      prev[curr] = !!prev[curr] ? prev[curr]+1 : 1;
      return prev;
    }, {});
    // let maxRowHeight = Math.max(...rowHeights);
    let weighedAverageRowHeight = d3.keys(rowHeightsFreq).reduce((prev, curr) => {
      return prev + (curr * rowHeightsFreq[curr]);
    }, 0) / d3.values(rowHeightsFreq).reduce((prev, curr) => prev + curr, 0);

    console.log('weighedAverageRowHeight: ' + weighedAverageRowHeight);
    console.log('Math.floor(availableHeight / weighedAverageRowHeight): ' + Math.floor(availableHeight / weighedAverageRowHeight));
    return Math.floor(availableHeight / weighedAverageRowHeight);
  }

  determineColumnWidths() {
    // determina largura disponível para a tabela
    let availableWidth = this.containerEl.node().getClientRects()[0].width;

    // mostra um "loading" para "esconder os cálculos"
    this.containerEl.append('div').classed('loading-mask', true);

    // carrega todos os dados na tabela (paginateDate(-1))
    this.paginateData(-1);

    // determina qual a quantidade de linhas por página
    this.rowsPerPage = this.determineRowsPerPage();
    // espera 1 tick para que o navegador renderize toda a tabela
    setTimeout(() => {
      // encontra a largura computada para cada coluna
      // e define a largura para cada célula do cabeçalho
      this.tableEl.selectAll('th').each((d, i, nodes) => {
        nodes[i].style.maxWidth = `${nodes[i].getClientRects()[0].width/availableWidth}%`;
        // nodes[i].style.width = `${nodes[i].getClientRects()[0].width}px`;
      });

      // carrega os dados da página atual
      this.paginateData(0);

      // tira o "loading"
      this.containerEl.select('.loading-mask').remove();

    }, 200);
  }
}

class TableColumn {
  constructor(originalName, label,  cl, transform, format, processor) {
    this.originalName = originalName;
    this.label = label;
    this.cl = cl || '';
    this.transform = transform || (s => s);
    format = format || (s => s)
    this.format = Array.isArray(format) ? format : [format];
    processor = processor || (s => s);
    this.processor = Array.isArray(processor) ? processor : [processor];
  }
}

// class TableColumnNumber extends TableColumn {
//   constructor(originalName, label, cl, decimals) {
//     super(...arguments);
//     this.transformation =
//   }
// }

let formats = {
  asDate: date => d3.timeFormat('%m/%d/%Y')(date),
  asNumber: (num, decimals) => Number.isNaN(num) ? '' : d3.format(`.${decimals}f`)(num),
  asCurrency: (num, units, symbol) => `${symbol} ` + d3.format(',')(num/units),
  asCurrencyName: str => `<abbr title="${{
      'CAD': 'Canadian Dollar',
      'EUR': 'Euro',
      'USD': 'United States Dollar'
    }[str]}">${str}</abbr>`,
  asStateAbbreviation: str => `<abbr title="${{
      'AL': 'Alabama',
      'AK': 'Alaska',
      'AZ': 'Arizona',
      'AR': 'Arkansas',
      'CA': 'California',
      'CO': 'Colorado',
      'CT': 'Connecticut',
      'DE': 'Delaware',
      'FL': 'Florida',
      'GA': 'Georgia',
      'HI': 'Hawaii',
      'ID': 'Idaho',
      'IL': 'Illinois',
      'IN': 'Indiana',
      'IA': 'Iowa',
      'KS': 'Kansas',
      'KY': 'Kentucky',
      'LA': 'Louisiana',
      'ME': 'Maine',
      'MD': 'Maryland',
      'MA': 'Massachusetts',
      'MI': 'Miami',
      'MN': 'Minnesota',
      'MS': 'Mississippi',
      'MO': 'Missouri',
      'MT': 'Montana',
      'NE': 'Nebraska',
      'NV': 'Nevada',
      'NH': 'New Hampshire',
      'NJ': 'New Jersey',
      'NM': 'New Mexico',
      'NY': 'New York',
      'NC': 'North Carolina',
      'ND': 'North Dakota',
      'OH': 'Ohio',
      'OK': 'Oklahoma',
      'OR': 'Oregon',
      'PA': 'Pennsylvania',
      'RI': 'Rhode Island',
      'SC': 'South Carolina',
      'SD': 'South Dakota',
      'TN': 'Tennessee',
      'TX': 'Texas',
      'UT': 'Utah',
      'VT': 'Vermont',
      'VA': 'Virginia',
      'WA': 'Washington',
      'WV': 'West Virginia',
      'WI': 'Winscoin',
      'WY': 'Wyoming'
    }[str]}">${str}</abbr>`,
  asSearchable: function(str) {
    let query = this.filterConfig.query;
    if (!query || query.trim() === '') {
      return str;
    }
    let term = query.replace(/(\s+)/,"(<[^>]+>)*$1(<[^>]+>)*");
    let pattern = new RegExp(`(${term})`, 'gi');
    str = str.replace(pattern, '<mark>$1</mark>');
    str = str.replace(/(<mark>[^<>]*)((<[^>]+>)+)([^<>]*<\/mark>)/, '$1</mark>$2<mark>$4');
    return str;
  }
};

let transforms = {
  toDate: str => new Date(str),
  toNumber: str => Number.isNaN(Number.parseFloat(str)) ? '' : Number.parseFloat(str),
  noop: x => x
};

let processors = {
  distinct: (col, data) => (col.distinctValues = (data.filter((d, i, self) => self.indexOf(d) === i))) && col,
  max: (col, data) => (col.maxValue = (Math.max(...data))) && col
}

let table = new Table({
  container: '#main-visualization',
  searchInput: '#search-input',
  statistics: '.statistics',
  pagination: '.pagination',
  headerTemplate: '#sortable-th-template',
  columns: [
    new TableColumn('permalink', 'Permalink', 'text-column', transforms.noop, [formats.asSearchable]),
    new TableColumn('company', 'Company', 'text-column', transforms.noop, [formats.asSearchable]),
    new TableColumn('numEmps', 'Employees', 'numeric-column mini-bar-column', transforms.toNumber, [num => formats.asNumber(num, 0), formats.asSearchable], [processors.max]),
    new TableColumn('category', 'Category', 'text-column', transforms.noop, [formats.asSearchable]),
    new TableColumn('city', 'City', 'text-column', transforms.noop, [formats.asSearchable]),
    new TableColumn('state', 'State', 'short-text-column', transforms.noop, [formats.asSearchable, formats.asStateAbbreviation]),
    new TableColumn('fundedDate', 'Funded When', 'date-column', transforms.toDate, [formats.asDate, formats.asSearchable]),
    new TableColumn('raisedAmt', 'Amount Raised', 'numeric-column mini-bar-column', transforms.toNumber, [(num, row) => formats.asCurrency(num, 1, row.raisedCurrency), formats.asSearchable], [processors.max]),
    new TableColumn('raisedCurrency', 'Currency', 'short-text-column', transforms.noop, [formats.asSearchable, formats.asCurrencyName]),
    new TableColumn('round', 'Round', 'short-text-column', transforms.noop, [formats.asSearchable]),
  ]
});
table.loadFromCSV('data/dados-tp1.csv');
