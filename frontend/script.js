// Variáveis globais para sensores e tipos de gráfico
let availableSensors = [];
let selectedSensors = [];
let chartTypes = {};
let sensorSearchTerm = '';

// Função para buscar dados de telemetria
async function fetchTelemetryData() {
  try {
    const response = await fetch('http://localhost:5000/api/telemetry');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    return [];
  }
}

// Função para popular a lista de sensores (checkboxes)
async function populateSensorList() {
  const data = await fetchTelemetryData();
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  availableSensors = keys.filter(key => key !== 'Time' && key !== 'Lap Time');
  renderSensorList();
}

// Função para renderizar a lista de sensores, aplicando filtro e ordenação
function renderSensorList() {
  const form = document.getElementById('sensor-form');
  if (!form) return;
  form.innerHTML = '';

  // Filtro de pesquisa
  let filteredSensors = availableSensors.filter(sensor =>
    sensor.toLowerCase().includes(sensorSearchTerm.toLowerCase())
  );

  // Sensores selecionados primeiro
  filteredSensors.sort((a, b) => {
    const aSel = selectedSensors.includes(a);
    const bSel = selectedSensors.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return a.localeCompare(b);
  });

  filteredSensors.forEach(sensor => {
    const label = document.createElement('label');
    label.className = 'sensor-checkbox-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sensor-checkbox';
    checkbox.value = sensor;
    if (selectedSensors.includes(sensor)) checkbox.checked = true;
    checkbox.addEventListener('change', handleSensorSelection);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(sensor));
    form.appendChild(label);
  });
}

// Handler para seleção de sensores
function handleSensorSelection(e) {
  const sensor = e.target.value;
  if (e.target.checked) {
    if (!selectedSensors.includes(sensor)) selectedSensors.unshift(sensor); // Adiciona no topo
    chartTypes[sensor] = 'lines'; // padrão
  } else {
    selectedSensors = selectedSensors.filter(s => s !== sensor);
    delete chartTypes[sensor];
  }
  renderSensorList();
  renderChartsGrid();
}

// Handler para tipo de gráfico individual
function handleChartTypeChange(sensor, e) {
  chartTypes[sensor] = e.target.value;
  renderChartsGrid();
}

// Handler para pesquisa de sensores
function handleSensorSearch(e) {
  sensorSearchTerm = e.target.value;
  renderSensorList();
}

// Função para adicionar o listener de resize do GridStack
function addGridstackResizeListener(grid) {
  if (grid && !grid._resizeListenerAdded) {
    grid.on('resizestop', function(event, el) {
      const plotDiv = el.querySelector('.chart-plot');
      if (plotDiv) {
        Plotly.Plots.resize(plotDiv);
      }
    });
    grid._resizeListenerAdded = true;
  }
}

// Renderiza o grid de gráficos dinâmicos usando Gridstack.js
async function renderChartsGrid() {
  const data = await fetchTelemetryData();
  const gridEl = document.getElementById('charts-grid');
  if (!gridEl) return;

  // Inicializa Gridstack se ainda não estiver
  let grid = gridEl.gridstack;
  if (!grid) {
    grid = GridStack.init({
      cellHeight: 80, // valor menor para widgets mais compactos
      float: true,
      resizable: { handles: 'all' },
      draggable: { handle: '.chart-header' }
    }, gridEl);
    addGridstackResizeListener(grid);
  }

  // Salva o layout atual antes de remover widgets
  let layout = [];
  if (grid.engine && grid.engine.nodes) {
    layout = grid.engine.nodes.map(node => {
      // O sensor é salvo no id do widget
      const sensorId = node.el && node.el.getAttribute('data-sensor');
      return {
        id: sensorId,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h
      };
    });
  }

  // Remove todos os widgets antes de adicionar os novos
  grid.removeAll();
  gridEl.innerHTML = '';

  // Adiciona widgets para cada sensor selecionado
  selectedSensors.forEach((sensor, idx) => {
    // Tenta restaurar posição/tamanho do layout salvo
    let w = 6, h = 2, x = (idx % 2) * 6, y = Math.floor(idx / 2) * 2;
    const cellHeight = 80;
    let layoutItem = layout.find(item => item.id === sensor);
    if (selectedSensors.length === 1) {
      w = 12;
      h = Math.max(3, Math.round((window.innerHeight * 0.6) / cellHeight));
      x = 0;
      y = 0;
    } else {
      h = Math.max(3, h);
    }
    if (layoutItem) {
      x = layoutItem.x;
      y = layoutItem.y;
      w = layoutItem.w;
      h = layoutItem.h;
    } else {
      if (selectedSensors.length === 2) { w = 12; x = 0; y = idx * h; }
      if (selectedSensors.length === 3 && idx === 0) { w = 12; x = 0; y = 0; }
      if (selectedSensors.length === 3 && idx > 0) { w = 6; x = (idx-1) * 6; y = h; }
    }
    // Cria o conteúdo do widget
    const widget = document.createElement('div');
    widget.className = 'grid-stack-item';
    widget.setAttribute('gs-x', x);
    widget.setAttribute('gs-y', y);
    widget.setAttribute('gs-w', w);
    widget.setAttribute('gs-h', h);
    widget.setAttribute('data-sensor', sensor); // para identificar o sensor no layout
    widget.innerHTML = `
      <div class="grid-stack-item-content">
        <div class="chart-container-dynamic">
          <div class="chart-header">
            <label>${sensor}</label>
            <select>
              <option value="lines"${chartTypes[sensor]==='lines'?' selected':''}>Linha</option>
              <option value="bar"${chartTypes[sensor]==='bar'?' selected':''}>Barra</option>
              <option value="scatter"${chartTypes[sensor]==='scatter'?' selected':''}>Dispersão</option>
            </select>
          </div>
          <div class="chart-plot" id="plot-${sensor.replace(/\W/g,'_')}" style="height:100%;min-height:100px;"></div>
        </div>
      </div>
    `;
    gridEl.appendChild(widget);
    grid.makeWidget(widget);
    // Evento de tipo de gráfico
    widget.querySelector('select').addEventListener('change', e => {
      chartTypes[sensor] = e.target.value;
      renderChartsGrid();
    });
    // Renderiza o gráfico
    renderSingleChart(data, sensor, chartTypes[sensor], `plot-${sensor.replace(/\W/g,'_')}`);
  });

  // Força o resize de todos os gráficos após o grid ser montado
  setTimeout(() => {
    document.querySelectorAll('.chart-plot').forEach(plotDiv => {
      Plotly.Plots.resize(plotDiv);
    });
  }, 200);
}

// Renderiza um gráfico individual
function renderSingleChart(data, sensor, chartType, plotId) {
  let plotType = 'scatter';
  let mode = 'lines';
  if (chartType === 'bar') {
    plotType = 'bar';
    mode = undefined;
  } else if (chartType === 'scatter') {
    plotType = 'scatter';
    mode = 'markers';
  } else {
    plotType = 'scatter';
    mode = 'lines';
  }
  const trace = {
    x: data.map(d => d.Time),
    y: data.map(d => parseFloat(d[sensor])),
    name: sensor,
    type: plotType,
    line: {color: '#b1975a', width: 2},
    marker: {color: '#b1975a'},
    mode: mode
  };
  Plotly.newPlot(plotId, [trace], {
    title: `${sensor} vs Tempo`,
    paper_bgcolor: '#232323',
    plot_bgcolor: '#232323',
    margin: {l: 50, r: 20, t: 40, b: 40},
    xaxis: {
      title: 'Tempo (s)',
      color: '#ffffff',
      tickfont: {color: '#ffffff'},
      gridcolor: '#333333',
      zerolinecolor: '#333333'
    },
    yaxis: {
      title: sensor,
      color: '#ffffff',
      tickfont: {color: '#ffffff'},
      gridcolor: '#333333',
      zerolinecolor: '#333333'
    },
    showlegend: false,
    font: {
      color: '#ffffff'
    }
  }, {displayModeBar: false});
}

// Inicializa o dashboard
async function initDashboard() {
  await populateSensorList();
  // Evento de pesquisa
  const searchInput = document.getElementById('sensor-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSensorSearch);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Inicializa dashboard e sensores
  initDashboard();
});

// Carrega Plotly.js dinamicamente
(function(){
  const script = document.createElement('script');
  script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
  document.head.appendChild(script);
})(); 