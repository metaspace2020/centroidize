var m = require('mithril'); // lightweight MVC framework

var Papa = require('papaparse'); // CSV parsing library

var Clipboard = require('clipboard');

// apodization with hardcoded Slepian window (10, 0.3)
var apodizationWindow = [ 0.51506647,  0.68484875,  0.83269045,  0.94195613,  1.,
                            1.        ,  0.94195613,  0.83269045,  0.68484875,  0.51506647];
var apodizationWindowSum = 7.949123611116792;
var L = apodizationWindow.length;

var centroidingWindowSize = 15;

var SpectrumParser = {};

SpectrumParser.data = {mzs: [], intensities: []};
for (var k = 0; k < L / 2; k++)
    SpectrumParser.data.intensities.push(0);

SpectrumParser.parseChunk = function(chunk, parser) {
    if (chunk.errors)
        app.vm.errorMessage(chunk.errors);

    var n = chunk.data.length;
    var sp = SpectrumParser;
    var start = sp.data.mzs.length > 0 ? 0 : 1; // skip the header
    for (var i = start; i < n; i++) {
        sp.data.mzs.push(chunk.data[i][0]);
        sp.data.intensities.push(chunk.data[i][1]);
    }
    var nPeaks = sp.data.mzs.length;

    app.vm.csvParsingProgress(Math.floor(chunk.meta.cursor / sp.fileSize * 100.0));
    m.redraw(true);
}

SpectrumParser.onComplete = function(results, file) {
    var sp = SpectrumParser;

    for (var k = 0; k < L - L/2; k++)
        sp.data.intensities.push(0);

    var apodizedIntensities = [];
    var n = sp.data.intensities.length - L;
    for (var i = 0; i < n; i++) {
        var tmp = 0;
        for (var j = 0; j < L; j++)
            tmp += apodizationWindow[j] * sp.data.intensities[i + j];
        apodizedIntensities.push(tmp / apodizationWindowSum);
    }
    sp.data.intensities = apodizedIntensities;

    var N = centroidingWindowSize;
    var halfN = Math.floor(centroidingWindowSize / 2);
    var centroids = [];
    var centroidIntensities = [];
    for (var i = halfN; i < n - (N - halfN); i++) {
        var isLocalMaximum = (sp.data.intensities[i - 1] < sp.data.intensities[i] &&
                              sp.data.intensities[i] >= sp.data.intensities[i + 1]);
        if (isLocalMaximum === false)
            continue;

        var mz = 0.0;
        var totalIntensity = 0.0;
        var maxIntensity = 0.0;
        for (var j = i - halfN; j < i + N - halfN; j++) {
            totalIntensity += sp.data.intensities[j];
            mz += sp.data.intensities[j] * sp.data.mzs[j];
            maxIntensity = Math.max(maxIntensity, sp.data.intensities[j]);
        }
        mz /= totalIntensity;
        centroids.push([mz, maxIntensity]);
        centroidIntensities.push(maxIntensity);
    }

    // take at most 10000 peaks as centroids
    centroidIntensities.sort(function(a, b) { return b - a; });
    var threshold = centroidIntensities[Math.min(9999, centroidIntensities.length - 1)];
    centroids = centroids.filter(function(c) { return c[1] >= threshold; });

    var table = {
        fields: ['m/z'],
        data: centroids.map(function(c) { return [c[0]]; })
    };
    app.vm.message('');
    app.vm.resultCsv(Papa.unparse(table));
    app.vm.finished(true);
    m.redraw();
}

SpectrumParser.parse = function(files) {
    var csv = files[0];
    var config = {
        delimiter: ",",
        header: false,
        dynamicTyping: true,
        skipEmptyLines: true,
        comments: "#",
        fastMode: true,
        chunk: SpectrumParser.parseChunk,
        complete: SpectrumParser.onComplete
    };
    app.vm.gotCsv(true);
    m.redraw();

    SpectrumParser.fileSize = csv.size;

    Papa.parse(csv, config);
}

var app = {};

app.vm = {
    init: function() {
        app.vm.errorMessage = m.prop('');
        app.vm.message = m.prop('');
        app.vm.resultCsv = m.prop('');
        app.vm.gotCsv = m.prop(false);
        app.vm.finished = m.prop(false);
        app.vm.copiedToClipboard = m.prop(false);
        app.vm.csvParsingProgress = m.prop(0);
    }
}

app.controller = function() {
    app.vm.init();
}

var nVisibleRows = 15;

function mImg(src) {
    return m('img', {src: src, style: {'max-width': '100%', 'height': 'auto'}});
}

function scilsExportDiv () {
    return m('div', [
        m('label', 'Select the overview spectrum CSV exported from SCiLS'),
        m('input', {
            type: 'file',
            id: 'csv-input',
            onchange: m.withAttr('files', SpectrumParser.parse)
        }),
        mImg('static/images/export_csv.png')
    ]);
}

function whatsHappeningDiv() {
    return m('p', {class: 'bg-info'},
             `Parsing CSV... ${app.vm.csvParsingProgress()}% complete`
    );
}

function copyToClipboardDiv() {
    return m('div',
      [m('p', {class: 'bg-info'},
         "Please copy the result to the clipboard by clicking the button"),
       m('button', {class: 'btn',
                    'data-clipboard-target': '#csv-result'},
         "Copy values to clipboard"),
       m('textarea', {class: 'form-control',
                      id: 'csv-result',
                      readonly: true, rows: nVisibleRows,
                      value: app.vm.resultCsv()})
      ]);
}

function nextStepsDiv() {
    return m('div', [
        m('div', {class: 'alert alert-success'},
          'Almost done! Now open the dialog as shown below and press \'Paste values from clipboard\' button'),
        m('div', [
            mImg('static/images/import_csv.png'),
            mImg('static/images/paste_values.png')
        ])
    ]);
}

app.view = function(ctrl) {
    var panelContents;
    if (!app.vm.gotCsv())
        panelContents = [scilsExportDiv()];
    else if (app.vm.gotCsv() && !app.vm.finished())
        panelContents = [whatsHappeningDiv(), m('hr'), m('div', app.vm.message())];
    else if (!app.vm.copiedToClipboard())
        panelContents = [copyToClipboardDiv()];
    else
        panelContents = [nextStepsDiv()];

    var result = m('div', {class: 'form-group col-sm-12'}, panelContents);

    if (app.vm.errorMessage() != '') {
        var errorDiv = m('div', {class: 'col-sm-12 alert alert-warning'},
                         app.vm.errorMessage());
        result = [errorDiv].concat(result);
    }
    return result;
}

m.mount(document.getElementById('app-container'), app);

var clipboard = new Clipboard('.btn');
clipboard.on('success', function(e) {
    app.vm.copiedToClipboard(true);
    m.redraw();
    e.clearSelection();
});

clipboard.on('error', function(e) {
    app.vm.errorMessage('Failed to copy result to clipboard, please use Ctrl-C');
    m.redraw();
});
