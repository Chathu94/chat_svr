var express = require('express');
var PubSub = require('pubsub-js');
var mysql = require('mysql');
var app = express();
var changes = express();
var expressWs = require('express-ws')(app);
var expressCh = require('express-ws')(changes);

var pool = mysql.createPool({
     connectionLimit : 100,
     host     : '127.0.0.1',
     user     : 'root',
     password : '',
     database : 'ai_bot',
     debug    :  false,
     multipleStatements: true
 });

function mysql_query({ query, params=null, callback=null}) {
     pool.getConnection( (err,connection)=>{
         if (err) {
           console.log( err );
           try {
             connection.release();
           } catch(e) {
             console.log( e );
           }

           return false;
         }
         console.log('connected as id ' + connection.threadId);
         connection.query( query, params, function(err,rows){
             connection.release();
             if ( callback!=null ){
               callback( err, rows );
             }
         });
         connection.on('error', function(err) {
               return;
         });
   });
 }

function mysql_real_escape(str){
  if(str == '') { return str }
  return pool.escape( str )
}

app.use( (req, res, next)=>{
  return next();
});

changes.use( (req, res, next)=>{
  return next();
});

app.get('/', (req, res, next)=>{
  res.send('Nothing to see here!');
  res.end();
});

app.ws('/', (ws, req)=>{
  ws.on('message', function(msg) {
    let command;
    try {
      command = JSON.parse(msg);
    } catch(e) {
      ws.send( JSON.stringify( { error : "JSON.parse failed" } ) );
      return;
    }
    if ( command != null && command.type != null ){
      switch ( command.type.toLowerCase() ){
        // Answer
        case "add_answer": {
          if ( command.data != null ){
            let data = command.data;
            let query = "INSERT INTO answer SET ?";
            mysql_query( { query: query, params: { answer: command.data.answer }, callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              PubSub.publish( 'answer_change', JSON.stringify( { type : 'insert', data: { id:  r.insertId, answer: command.data.answer } } ) );
              ws.send( JSON.stringify( { error : false, data : { answer: command.data.answer } } ) );
            } } );
          } else {
            ws.send( JSON.stringify( { error : "{ COMMAND.DATA } Nulled." } ) );
            return;
          }
          return;
        }
        case "list_answer": {
          let query = "SELECT * FROM answer";
          mysql_query( { query: query, callback: (e, r) => {
            if (e) ws.send( JSON.stringify( { error : e.message} ) );
            ws.send( JSON.stringify( { error : false, rows : r } ) );
          } } );
          return;
        }
        case "edit_answer": {
          if ( command.data != null && command.data.answer != null && command.data.id != null ){
            let query = "UPDATE answer SET answer = ? WHERE id = ?";
            mysql_query( { query: query, params: [ command.data.answer, command.data.id ], callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              PubSub.publish( 'answer_change', JSON.stringify( { type : 'update', data: { id: command.data.id, answer: command.data.answer } } ) );
              ws.send( JSON.stringify( { error : false, data: { id: command.data.id } } ) );
            } } );
          }
          break;
        }
        case "delete_answer": {
          if ( command.data != null && command.data.id != null ){
            console.log("Delete", command.data.id)
            let query = "DELETE FROM answer WHERE id = " + mysql_real_escape( command.data.id ) + " ;\n";
            query += "UPDATE links SET answer = CASE WHEN answer LIKE '%," + mysql_real_escape( command.data.id ) + ",%' THEN REPLACE(answer, '," + mysql_real_escape( command.data.id ) + ",', ',') WHEN answer LIKE '" + mysql_real_escape( command.data.id ) + ",%' THEN REPLACE(answer, '" + mysql_real_escape( command.data.id ) + ",', '') WHEN answer LIKE '%," + mysql_real_escape( command.data.id ) + "' THEN REPLACE(answer, '," + mysql_real_escape( command.data.id ) + "', '') WHEN answer = '" + mysql_real_escape( command.data.id ) + "' THEN '' END WHERE FIND_IN_SET('" + mysql_real_escape( command.data.id ) + "', answer);";
            console.log(query)
            mysql_query( { query: query, callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              PubSub.publish( 'answer_change', JSON.stringify( { type : 'delete', data: { id: command.data.id } } ) );
              ws.send( JSON.stringify( { error : false, data: { id: command.data.id } } ) );
            } } );
          }
          break;
        }
        // Keyword
        case "add_keyword": {
          if ( command.data != null ){
            let data = command.data;
            let query = "INSERT INTO keywords SET ?";
            mysql_query( { query: query, params: { keyword: command.data.keyword }, callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              if (!e){
                PubSub.publish( 'keyword_change', JSON.stringify( { type : 'insert', data: { id:  r.insertId, keyword: command.data.keyword } } ) );
                ws.send( JSON.stringify( { error : false, data : { keyword: command.data.keyword } } ) );
              }
            } } );
          } else {
            ws.send( JSON.stringify( { error : "{ COMMAND.DATA } Nulled." } ) );
            return;
          }
          return;
        }
        case "list_keyword": {
          let query = "SELECT * FROM keywords";
          mysql_query( { query: query, callback: (e, r) => {
            if (e) ws.send( JSON.stringify( { error : e.message} ) );
            ws.send( JSON.stringify( { error : false, rows : r } ) );
          } } );
          return;
        }
        case "edit_keyword": {
          if ( command.data != null && command.data.keyword != null && command.data.id != null ){
            let query = "UPDATE keywords SET keyword = ? WHERE id = ?";
            mysql_query( { query: query, params: [ command.data.keyword, command.data.id ], callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              PubSub.publish( 'keyword_change', JSON.stringify( { type : 'update', data: { id: command.data.id, keyword: command.data.keyword } } ) );
              ws.send( JSON.stringify( { error : false, data: { id: command.data.id } } ) );
            } } );
          }
          break;
        }
        case "delete_keyword": {
          if ( command.data != null && command.data.id != null ){
            let query = "DELETE FROM keywords WHERE id = " + mysql_real_escape( command.data.id ) + ";\n";
            query += "UPDATE links SET keyword = CASE WHEN keyword LIKE '%," + mysql_real_escape( command.data.id ) + ",%' THEN REPLACE(keyword, '," + mysql_real_escape( command.data.id ) + ",', ',') WHEN keyword LIKE '" + mysql_real_escape( command.data.id ) + ",%' THEN REPLACE(keyword, '" + mysql_real_escape( command.data.id ) + ",', '') WHEN keyword LIKE '%," + mysql_real_escape( command.data.id ) + "' THEN REPLACE(keyword, '," + mysql_real_escape( command.data.id ) + "', '') WHEN keyword = '" + mysql_real_escape( command.data.id ) + "' THEN '' END WHERE FIND_IN_SET('" + mysql_real_escape( command.data.id ) + "', keyword);";
            mysql_query( { query: query, callback: (e, r) => {
              if (e) ws.send( JSON.stringify( { error : e.message} ) );
              PubSub.publish( 'keyword_change', JSON.stringify( { type : 'delete', data: { id: command.data.id } } ) );
              ws.send( JSON.stringify( { error : false, data: { id: command.data.id } } ) );
            } } );
          }
          break;
        }
        // Keyword set
        case "add_keyword_set": {
          console.log(command.data)
          if ( command.data != null && command.data.iden != null && command.data.keywords != null ){
            let data = command.data
            let query = ""
            let select = "SELECT "
            let nthk = 0
            let nrmk = ""
            data.keywords.split(',').forEach( (k) => {
              if ( /^\+?(0|[1-9]\d*)$/.test(k) ){
                nrmk = ( nrmk == "" ) ? k : nrmk + "," + k
              } else {
                query += "INSERT INTO keywords SET keyword=" + mysql_real_escape( k ) + ";\n"
                query += "SET @kwd_" + nthk + " = LAST_INSERT_ID();\n"
                select += "@kwd_" + nthk + " as kwd_" + nthk + ", " + mysql_real_escape( k ) + " as kwdv_" + nthk + ", "
                nthk += 1
              }
            } )
            nrmk = ( nrmk == "" ) ? "CONCAT(" : "CONCAT(\"" + nrmk
            let nrmka = "";
            for (i = 0; i < nthk; i++) {
              if ( nrmka == "" ){
                if ( nrmk != "CONCAT(" ){
                  nrmk += ",\", "
                }
                nrmka = "@kwd_" + i
              } else {
                nrmka += ", \",\", @kwd_" + i
              }
            }
            nrmk += ( nrmka == "" ) ? nrmka + "\" )" : nrmka + " )"
            query += "INSERT INTO keywords_set SET iden=" + mysql_real_escape( command.data.iden ) + ", keywords=" + nrmk + ";\n"
            query += select
            query += " keywords_set.* FROM keywords_set WHERE keywords_set.id = LAST_INSERT_ID();"
            console.log( query )

            // mysql_query( { query: query, params: { iden: command.data.iden, keywords: command.data.keywords }, callback: (e, r) => {
            //   if (e){
            //     ws.send( JSON.stringify( { error : e.message} ) )
            //     return;
            //   } else {
            //     let values = r[ r.length - 1 ][0];
            //     for (i = 0; i < nthk; i++) {
            //       PubSub.publish( 'keyword_change', JSON.stringify( { type : 'insert', data: { id:  values['kwd_' + i], keyword: values['kwdv_' + i] } } ) );
            //     }
            //     PubSub.publish( 'keyword_set_change', JSON.stringify( { type : 'insert', data: { id:  values.id, iden: values.iden, keyword: values.keywords } } ) );
            //     ws.send( JSON.stringify( { error : false, data : { id:  values.id, iden: values.iden, keyword: values.keywords } } ) );
            //   }
            //} } );
          } else {
            ws.send( JSON.stringify( { error : "{ COMMAND.DATA } Nulled." } ) );
            return;
          }
          return;
        }
        // Link
        case "add_link": {
          if ( command.data != null ){
            let data = command.data;
            let query = "";
            let select = "SELECT ";
            let ntha = 0;
            let nrma = "";
            data.answers.split(',').forEach( (a) => {
              if ( /^\+?(0|[1-9]\d*)$/.test(a) ){
                nrma = ( nrma == "" ) ? a : nrma + "," + a
              } else {
                query += "INSERT INTO answer SET answer=" + mysql_real_escape( a ) + ";\n"
                query += "SET @ans_" + ntha + " = LAST_INSERT_ID();\n"
                select += "@ans_" + ntha + " as ans_" + ntha + ", " + mysql_real_escape( a ) + " as ansv_" + ntha + ", "
                ntha += 1
              }
            } )
            let nthk = 0;
            let nrmk = "";
            data.keywords.split(',').forEach( (k) => {
              if ( /^\+?(0|[1-9]\d*)$/.test(k) ){
                nrmk = ( nrmk == "" ) ? k : nrmk + "," + k
              } else {
                query += "INSERT INTO keywords SET keyword=" + mysql_real_escape( k ) + ";\n"
                query += "SET @kwd_" + nthk + " = LAST_INSERT_ID();\n"
                select += "@kwd_" + nthk + " as kwd_" + nthk + ", " + mysql_real_escape( k ) + " as kwdv_" + nthk + ", "
                nthk += 1
              }
            } )
            nrma = ( nrma == "" ) ? "CONCAT(" : "CONCAT(\"" + nrma
            nrmk = ( nrmk == "" ) ? "CONCAT(" : "CONCAT(\"" + nrmk
            let nrmaa = "";
            for (i = 0; i < ntha; i++) {
              if ( nrmaa == "" ){
                if ( nrma != "CONCAT(" ){
                  nrma += ",\", "
                }
                nrmaa = "@ans_" + i
              } else {
                nrmaa += ", \",\", @ans_" + i
              }
            }
            let nrmka = "";
            for (i = 0; i < nthk; i++) {
              if ( nrmka == "" ){
                if ( nrmk != "CONCAT(" ){
                  nrmk += ",\", "
                }
                nrmka = "@kwd_" + i
              } else {
                nrmka += ", \",\", @kwd_" + i
              }
            }

            nrma += ( nrmaa == "" ) ? nrmaa + "\" )" : nrmaa + " )"
            nrmk += ( nrmka == "" ) ? nrmka + "\" )" : nrmka + " )"
            query += "INSERT INTO links SET answer=" + nrma + ", keyword=" + nrmk + ";\n"
            query += select

            query += " links.* FROM links WHERE links.id = LAST_INSERT_ID();"
            console.log(query);
            mysql_query( { query: query, params: { keyword: command.data.keyword }, callback: (e, r) => {
              if (e){
                ws.send( JSON.stringify( { error : e.message } ) )
                return;
              }
              if (!e){
                let values = r[ r.length - 1 ][0];
                for (i = 0; i < ntha; i++) {
                  PubSub.publish( 'answer_change', JSON.stringify( { type : 'insert', data: { id:  values['ans_' + i], answer: values['ansv_' + i] } } ) );
                  console.log( 'answer_change', JSON.stringify( { type : 'insert', data: { id:  values['ans_' + i], answer: values['ansv_' + i] } } ) );
                }
                for (i = 0; i < nthk; i++) {
                  PubSub.publish( 'keyword_change', JSON.stringify( { type : 'insert', data: { id:  values['kwd_' + i], keyword: values['kwdv_' + i] } } ) );
                  console.log( 'answer_change', JSON.stringify( { type : 'insert', data: { id:  values['ans_' + i], answer: values['ansv_' + i] } } ) );
                }
                PubSub.publish( 'link_change', JSON.stringify( { type : 'insert', data: { id:  values.id, answer: values.answer, keyword: values.keyword } } ) );
                ws.send( JSON.stringify( { error : false, data: { id:  values.id, answer: values.answer, keyword: values.keyword } } ) );
              }
            } } );
            console.log( command.data )
          } else {
            ws.send( JSON.stringify( { error : "{ COMMAND.DATA } Nulled." } ) );
            return;
          }
          return;
        }
        case "list_link": {
          let query = "SELECT * FROM links";
          mysql_query( { query: query, callback: (e, r) => {
            if (e){
              ws.send( JSON.stringify( { error : e.message} ) )
              return;
            }
            ws.send( JSON.stringify( { error : false, rows : r } ) );
          } } );
          return;
        }
        case "delete_link": {
          if ( command.data != null && command.data.id != null ){
            let query = "DELETE FROM links WHERE id = ?";
            mysql_query( { query: query, params: [ command.data.id ], callback: (e, r) => {
              if (e){
                ws.send( JSON.stringify( { error : e.message} ) )
                return;
              }
              PubSub.publish( 'link_change', JSON.stringify( { type : 'delete', data: { id: command.data.id } } ) );
              ws.send( JSON.stringify( { error : false, data: { id: command.data.id } } ) );
            } } );
          }
          break;
        }
        case "update_link": {
          //let query =
        }
        // E O Life
        case "hello": {
          ws.send( "HELLO BACK" );
        }
        default: {
          ws.send( "Unknown Command '" + command.type + "'" );
        }
      }
    } else {
      ws.send( JSON.stringify( { error : "JSON.parse failed" } ) );
      return;
    }
  });
});

changes.ws('/', (ws, req)=>{
  var tokena, tokenk, tokenl = null;
  ws.on('message', function(msg) {
    let command;
    try {
      command = JSON.parse(msg);
    } catch(e) {
      ws.send( JSON.stringify( { error : "JSON.parse failed" } ) );
      return;
    }
    if ( command != null && command.type != null ){
      switch ( command.type.toLowerCase() ){
        case "answers": {
          tokena = PubSub.subscribe( 'answer_change', function( msg, data ){
            //console.log( msg, data );
            ws.send( data );
          } );
          break;
        }
        case "keywords": {
          tokenk = PubSub.subscribe( 'keyword_change', function( msg, data ){
            //console.log( msg, data );
            ws.send( data );
          } );
          break;
        }
        case "links": {
          tokenl = PubSub.subscribe( 'link_change', function( msg, data ){
            //console.log( msg, data );
            ws.send( data );
          } );
          break;
        }
        case "hello": {
          ws.send( "HELLO BACK" );
          break;
        }
        default: {
          ws.send( "Unknown Command '" + command.type + "'" );
          break;
        }
      }
    } else {
      ws.send( JSON.stringify( { error : "JSON.parse failed" } ) );
      return;
    }
  });
  ws.on('close', function() {
    if ( tokena != null ){
      PubSub.unsubscribe( tokena );
    }
    if ( tokenk != null ){
      PubSub.unsubscribe( tokenk );
    }
    if ( tokenl != null ){
      PubSub.unsubscribe( tokenl );
    }
  });
});

app.listen(3000);
changes.listen(3001);
