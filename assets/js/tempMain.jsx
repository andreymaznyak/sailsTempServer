/**
 * Created by AndreyMaznyak on 09.12.2016.
 */
'use strict';
requirejs.config({
    paths: {
        'react': '/bower_components/react/react-with-addons',
        'reactdom': '/bower_components/react/react-dom',
        'jquery': '/bower_components/jquery/dist/jquery',
        'jquery.timeago': '/bower_components/jquery-timeago/jquery.timeago',
        'showdown': '/bower_components/showdown/compressed/Showdown',
        'bootstrap': '/bower_components/bootstrap/dist/js/bootstrap',
        'lodash':'/bower_components/lodash/lodash',
        'app': '/js'
    },

    shim: {
        'jquery.timeago': ["jquery"]
    }
});

require(['jquery', 'react', 'reactdom', 'app/CommentForm', 'app/CommentList','lodash'],
    function ($, React, ReactDOM, CommentForm, CommentList, _) {

        $(function whenDomIsReady() {

            // ReactDOM.render(
            // <CommentForm url='/cpu_temp'/>,
            //     document.getElementById('commentForm')
            // );


            // as soon as this file is loaded, connect automatically,
            var socket = io.sails.connect();

            console.log('Connecting to Sails.js...');
            // Subscribe to updates (a sails get or post will auto subscribe to updates)

            socket.get('/temperature?sort=createdAt&limit=100000', function (temp) {

                function getAproximateValue( current_x, current_elem, previous_elem){
                    let result = 0, previous_elem_date = new Date(previous_elem.createdAt);
                    previous_elem_date.setMilliseconds(0);
                    previous_elem_date.setSeconds(0);

                    let current_elem_date = new Date(current_elem.createdAt);
                    current_elem_date.setMilliseconds(0);
                    current_elem_date.setSeconds(0);
                    if(current_elem_date.getTime() != previous_elem_date.getTime()){
                        result = previous_elem.value + (current_elem.value - previous_elem.value) / ( (current_elem_date.getTime() - previous_elem_date.getTime()) / (current_x - previous_elem_date.getTime()));
                    }
                    else{
                        result = previous_elem.value;
                    }
                    if((result < 0) || (result < (previous_elem.value / 1.5)) || (result > (previous_elem.value * 1.5))){
                        result = previous_elem.value;
                    }
                    return result;

                }

                function pushToRow(row, indexes, index_alias, current_x, func_values) {
                    function addToRow(row, i, arr) {
                        if(i > 1 && (arr[i].value / arr[i - 1].value) < 0.5 ){
                            row.push(arr[i - 1].value);
                        }else{
                            row.push(arr[i].value);
                        }
                    }
                    const t = indexes[index_alias];
                    const current_func_x = new Date(func_values[t >= func_values.length ? t - 1: t].createdAt);
                    current_func_x.setMilliseconds(0);
                    current_func_x.setSeconds(0);
                    if(current_x < current_func_x.getTime()){
                        let previous_elem = t ? func_values[t - 1] : func_values[t],
                            value = getAproximateValue(current_x,func_values[t]/*current_func_x*/,previous_elem);
                        if(value / func_values[t].value < 0.5){
                            row.push(func_values[t].value);
                        }else{
                            row.push(value);
                        }


                    }else if(current_x > current_func_x.getTime()){
                        if((t + 1) < func_values.length ){
                            addToRow( row, t, func_values );
                            //row.push(getAproximateValue(current_x, func_values[t + 1], func_values[t]));
                            indexes[index_alias]++;
                        }else{
                            addToRow( row, t, func_values );
                        }

                    }else{
                        addToRow( row, t, func_values );
                        let length_var = func_values.length - 1;
                        if(t < length_var)  indexes[index_alias]++;
                    }
                }

                console.log('Listening...', temp);
                const total_data = [];

                for(let i = 0; i < temp.length; i++){
                    total_data.push([new Date(temp[i].createdAt), temp[i].value ]);//{ datetime: new Date(message[i].createdAt), message: message[i].value });//[/*new Date(*/new Date(message[i].createdAt),message[i].value]);
                }

                //google.charts.load('current', {'packages':['line']});
                //google.charts.setOnLoadCallback(drawChart);
                google.charts.load( 'visualization', '1', { packages: ['controls', 'charteditor'] } );
                google.charts.setOnLoadCallback(drawChart);


                function drawChart() {

                    const data = new google.visualization.DataTable();

                    data.addColumn('datetime', 'Дата');
                    data.addColumn('number', 'Температура воздуха');

                    data.addRows(total_data);

                    var options = new Object();
                    options['formatType'] = 'long';
                    options['timeZone'] = 10;
                    options['pattern'] = 'dd/MM/yyyy HH:mm:ss';
                    var formatter = new google.visualization.DateFormat(options);

                    formatter.format(data, 0);

                    var dash = new google.visualization.Dashboard(document.getElementById('dashboard'));

                    var control = new google.visualization.ControlWrapper({
                        controlType: 'ChartRangeFilter',
                        containerId: 'control_div',
                        options: {
                            filterColumnIndex: 0,
                            ui: {
                                chartOptions: {
                                    height: 100,
                                    width: 1600,
                                    chartArea: {
                                        width: '80%'
                                    }
                                },
                                chartView: {
                                    columns: [0, 1]
                                }
                            }
                        }
                    });

                    var chart = new google.visualization.ChartWrapper({
                        chartType: 'LineChart',
                        containerId: 'chart_div'
                    });

                    function setOptions (wrapper) {
                        // sets the options on the chart wrapper so that it draws correctly
                        wrapper.setOption('height', 600);
                        wrapper.setOption('width', 1600);
                        wrapper.setOption('hAxis', { format: 'dd/MM/yyyy HH:mm:ss' });
                        wrapper.setOption('chartArea.width', '80%');
                        // the chart editor automatically enables animations, which doesn't look right with the ChartRangeFilter
                        wrapper.setOption('animation.duration', 0);
                    }

                    setOptions(chart);

                    document.getElementById('edit').onclick = function () {
                        var editor = new google.visualization.ChartEditor();
                        google.visualization.events.addListener(editor, 'ok', function () {
                            chart = editor.getChartWrapper();
                            setOptions(chart);
                            dash.bind([control], [chart]);
                            dash.draw(data);
                        });
                        editor.openDialog(chart);
                    };

                    dash.bind([control], [chart]);
                    dash.draw(data);


                    // var dash = new google.visualization.Dashboard(document.getElementById('dashboard'));
                    //
                    // var control = new google.visualization.ControlWrapper({
                    //     controlType: 'ChartRangeFilter',
                    //     containerId: 'control_div',
                    //     options: {
                    //         filterColumnIndex: 0,
                    //         ui: {
                    //             chartOptions: {
                    //                 height: 50,
                    //                 width: 600,
                    //                 chartArea: {
                    //                     width: '80%'
                    //                 }
                    //             },
                    //             chartView: {
                    //                 columns: [0, 1]
                    //             }
                    //         }
                    //     }
                    // });
                    //
                    // console.log(total_data);
                    // data.addRows(total_data);
                    // // Equivalent property setting technique
                    // var options = new Object();
                    // options['formatType'] = 'long';
                    // options['timeZone'] = 10;
                    // options['pattern'] = 'dd/MM/yyyy HH:mm';
                    // var formatter = new google.visualization.DateFormat(options);
                    //
                    // formatter.format(data, 0);
                    //
                    // var options = {
                    //     chart: {
                    //         title: 'cpu_temp',
                    //         subtitle: 'cpu_temp'
                    //     },
                    //     width: data.getNumberOfRows() * 65,
                    //     height: 500,
                    //     axes: {
                    //         x: {
                    //             0: {side: 'bottom'}
                    //         }
                    //     },
                    //     hAxis: {
                    //         format: 'dd/MM/yyyy HH:mm'
                    //     },
                    //     title: 'price'
                    // };

                    //var chart = new google.charts.Line(document.getElementById('line_top_x'));

                    //chart.draw(data, options);
                }


                // initialize the view with the data property
                // ReactDOM.render(
                // <CommentList url='/cpu_temp' data={message} />,
                //     document.getElementById('commentList')
                // );

            });




            // Expose connected `socket` instance globally so that it's easy
            // to experiment with from the browser console while prototyping.
            window.socket = socket;

        });


    });