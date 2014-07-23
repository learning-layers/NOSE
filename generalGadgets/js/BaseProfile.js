var lasClient=null;

var cur_selected_dev;
var cur_sel_dev_saved_req;
var cur_sel_dev_saved_mediawiki;
//has the format [{"display" : "Ralf Klamma", "ReqBazaar":"RalfKlamma", "MediaWiki":"Ralf Klamma"}]
//So a mapping from what is saved in the database and also matching between req bazaar and mediawiki
var matched_list_of_devs = [];

var cur_main_platform = "pick a dev";
var cur_sec_platform = "pick a dev";
var cur_time_active = "pick a dev";

var defaultUserName = 'admin';
var defaultPassword = 'admin';
var serverURL ='http://steen.informatik.rwth-aachen.de:9912/';

/*
 * Called after the HTML document is loaded, initializes the lasClient needed to access LAS
 */
$( document ).ready(function() {
	lasClient = new LasAjaxClient("liiva", function(statusCode,message) {
		return NOSE_feedbackHandler(statusCode, message);
	});
	
	//The upper used callback function is for some reason not called, so just wait for lasClient to be ready.
	while(true){
		if(lasClient != null){
			NOSE_login();
			break;
		}
	}
});

/*
 * Is called when the user chooses a new name from the dropdown
 */
function dev_change(){
	if(document.getElementById("developer_select").value != ""){
		cur_selected_dev = document.getElementById("developer_select").value;
		// Save the name of the newly selected person
		for(var i = 0; i < matched_list_of_devs.length; i++) {
			if(matched_list_of_devs[i].display === cur_selected_dev){
				cur_sel_dev_saved_req = matched_list_of_devs[i].ReqBazaar;
				cur_sel_dev_saved_mediawiki = matched_list_of_devs[i].MediaWiki;
				break;
			}
		}
		NOSE_login();
	}
}

function NOSE_feedbackHandler(statusCode, message) {
	switch (statusCode) {
	case Enums.Feedback.LoginSuccess:
		// Ignore the login from session
		if(message.indexOf("(by stored session information)") === -1){
			// Skip filling the dev list if already done
			if(matched_list_of_devs.length < 1){
				NOSE_fill_dev_dropdown();
			}else{
				NOSE_show_widget_content();
			}
		}
	break;

	case Enums.Feedback.LogoutSuccess:
		console.log('logout success');
	break;
	case Enums.Feedback.LoginError:
		console.log(message);
	break;
	case Enums.Feedback.LogoutError:
		console.log(message);
		that.lasClient.verifyStatus();
	break;
	case Enums.Feedback.InvocationWorking:
		console.log(message);
	break;
	case Enums.Feedback.invocationSuccess:
	break;
	case Enums.Feedback.PingSuccess:
	break;
	case Enums.Feedback.PingSuccess:
	break;
	default:
		console.log("This status code is not being handled yet: "+ statusCode + ", " + message);
	break;
	}
};

function NOSE_login() {
	// Check if the user is already logged in
	if (lasClient.getStatus() === 'loggedIn') {
		console.log("someone was already logged in, so just execute");
		NOSE_show_widget_content();
	} else {
		lasClient.login(defaultUserName, defaultPassword,serverURL, 'RoleNoseDashboard');
	}
};

var invocationHandler = function(status, result) {
	if (status == 200 || status == 204) {
		console.log(result);
		lasClient.logout();
	} else {
		alert("Something went wrong. Please refresh");
		lasClient.logout();
	}
};

/*
 * Fills the dropdown with people from Requirements Bazaar and MediaWiki.
 * The participants are merged together into one list. 
 */
function NOSE_fill_dev_dropdown(){
	var devs_from_req_baz = null;
	var devs_from_mediawiki = null;
	var full_dev_list = [];
	
	//Get participants from Requirements Bazaar
	var paramsJSON = new Array();
	paramsJSON[0] = {"type": "String", "value": "requirementsBazaar"};
	paramsJSON[1] = {"type": "String", "value": "START n = node(0) MATCH (n)-[:USER]->(m)  RETURN m.firstName as firstname, m.lastName as lastname"};
	lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
		if(JSON.parse(result.value) == null){
			devs_from_req_baz=null;
		}else{
			devs_from_req_baz = JSON.parse(result.value);
		}
		//Get participants from the MediaWiki platform
		var paramsJSON = new Array();
		paramsJSON[0] = {"type": "String", "value": "layerswiki"};
		paramsJSON[1] = {"type": "String", "value": "SELECT DISTINCT cast(user_real_name as char(255)) as realname FROM layerswiki.user WHERE cast(user_real_name as char(255)) <> 'PDF' order by realname;"};
		lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
			if(JSON.parse(result.value) == null){
				devs_from_mediawiki=null;
			}else{
				devs_from_mediawiki = JSON.parse(result.value);
			}
			//add people from MediaWiki to the global managed list
			var dev;
			for(var i= 0; i<devs_from_mediawiki.length;i++){
				dev = devs_from_mediawiki[i].realname;
				//If the person is defined then add it to the list
				if(dev != ""){
					matched_list_of_devs.push({"display" : dev.trim(), "ReqBazaar":"", "MediaWiki":dev});
				}
			}
			
			// Format the names from Requirements Bazaar
			var dev_firstname;
			var dev_lastname;
			var dev_display_name;
			var dev_saved_name = [];
			for(var i= 0; i<devs_from_req_baz.data.length;i++){
				dev_firstname = devs_from_req_baz.data[i][0];
				dev_lastname = devs_from_req_baz.data[i][1];
				// not using people with emails as usernames
				if(dev_firstname != "" && dev_lastname != "" && dev_lastname.indexOf("@") == -1){
					dev_saved_name.push(dev_lastname);
					dev_display_name = dev_firstname.concat(dev_lastname);
					full_dev_list.push(dev_display_name);
				}
			}
			
			// options for the string matching algorithm, https://github.com/krisk/Fuse
			var options = {
				caseSensitive: false,
				includeScore: false,
				threshold: 0.2,
				location: 0,
				distance: 100
			};
			var full_dev_list2 = [];
			for(var j = 0; j<matched_list_of_devs.length; j++){
				full_dev_list2.push(matched_list_of_devs[j].display);
			}
			var fuse = new Fuse(full_dev_list2, options);
			//Check if there is a match from MediaWiki to Requirements Bazaar
			var result;
			
			for(var j = 0; j<full_dev_list.length; j++){
				result = fuse.search(full_dev_list[j]);
				if(result.length !== 0){
					matched_list_of_devs[result[0]].ReqBazaar = dev_saved_name[j];
				}else{
					matched_list_of_devs.push({"display" : full_dev_list[j], "ReqBazaar":full_dev_list[j], "MediaWiki":""});
				}
			}
			// Sort the list for better searching
			matched_list_of_devs.sort(function(a,b) { return a.display.localeCompare(b.display) } );
			
			//Fill the drop down in the UI
			var sel = document.getElementById("developer_select");
			for(var i = 0; i < matched_list_of_devs.length; i++) {
				var opt = document.createElement('option');
				opt.innerHTML = matched_list_of_devs[i].display;
				opt.value = matched_list_of_devs[i].display;
				sel.appendChild(opt);
			}
			
			//Set the current developer to the first person
			cur_selected_dev = matched_list_of_devs[0].display;
			cur_sel_dev_saved_req = matched_list_of_devs[0].ReqBazaar;
			cur_sel_dev_saved_mediawiki = matched_list_of_devs[0].MediaWiki;
			
			NOSE_show_widget_content();
		});
	});
}

function NOSE_show_widget_content(){
	$(".developer_name_span").html(cur_selected_dev);
	$("#dev_name").html(cur_selected_dev);
	
	// To add more information bits to the application the add another function call here
	NOSE_determine_active_platforms();
	NOSE_determine_time_active();
}

function NOSE_determine_active_platforms(){
	var contrib_req_baz = 0;
	var contrib_mediawiki = 0;
	
	if(cur_sel_dev_saved_mediawiki !== ""){
		//get contributions from mediawiki
		var paramsJSON = new Array();
		paramsJSON[0] = {"type": "String", "value": "layerswiki"};
		paramsJSON[1] = {"type": "String", "value": "SELECT cast(user_real_name as char(255)) as name, user_editcount FROM layerswiki.user WHERE cast(user_real_name as char(255)) LIKE '%"+cur_sel_dev_saved_mediawiki+"%'"};
		lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
			if(JSON.parse(result.value).length === 0){
				contrib_mediawiki=0;
			}else{
				contrib_mediawiki = JSON.parse(result.value)[0].user_editcount;
			}
			if(cur_sel_dev_saved_req !== ""){
				//get contributions from requirements bazaar
				var paramsJSON = new Array();
				paramsJSON[0] = {"type": "String", "value": "requirementsBazaar"};
				paramsJSON[1] = {"type": "String", "value": "START n = node(0) MATCH (n)-[:USER]->(m) -[r:INVENTOR_OF | VOTER_ON]->() WHERE m.lastName =~ '.*(?i)"+cur_sel_dev_saved_req+".*'RETURN m.lastName, count(r)"};
				lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
					if(JSON.parse(result.value).length === 0 || JSON.parse(result.value).data.length === 0){
						contrib_req_baz=0;
					}else{
						contrib_req_baz = JSON.parse(result.value).data[0][1];
					}
					NOSE_display_active_platforms(contrib_mediawiki, contrib_req_baz);
				});
			}else{
				contrib_req_baz=0;
				NOSE_display_active_platforms(contrib_mediawiki, contrib_req_baz);
			}
		});
	}else{
		contrib_mediawiki=0;
		//get contributions from requirements bazaar
		var paramsJSON = new Array();
		paramsJSON[0] = {"type": "String", "value": "requirementsBazaar"};
		paramsJSON[1] = {"type": "String", "value": "START n = node(0) MATCH (n)-[:USER]->(m) -[r:INVENTOR_OF | VOTER_ON]->() WHERE m.lastName =~ '.*(?i)"+cur_sel_dev_saved_req+".*'RETURN m.lastName, count(r)"};
		lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
			if(JSON.parse(result.value).length === 0 || JSON.parse(result.value).data.length === 0){
				contrib_req_baz=0;
			}else{
				contrib_req_baz = JSON.parse(result.value).data[0][1];
			}
			NOSE_display_active_platforms(contrib_mediawiki, contrib_req_baz);
		});
	}
}

/*
 * Display the result from active platforms
 */
function NOSE_display_active_platforms(contrib_mediawiki, contrib_req_baz){
	if(contrib_mediawiki === 0 && contrib_req_baz === 0){
		//The user is registered, but has not made any changes
		$("#platforms_main").html("None");
		$("#main_number_contributions").html(contrib_mediawiki);
		$("#platforms_additional").html("No other platform");
		$("#additional_number_contributions").html("");
	}else if(contrib_mediawiki>=contrib_req_baz && contrib_mediawiki>0){
		//The user has contributed more to the Layers MediaWiki
		$("#platforms_main").html("Layers Mediawiki");
		$("#main_number_contributions").html(contrib_mediawiki);
		if(contrib_req_baz>0){
			$("#platforms_additional").html("Requirements Bazaar");
			$("#additional_number_contributions").html("(with "+contrib_req_baz+" contributions)");
		}else{
			$("#platforms_additional").html("No other platform");
			$("#additional_number_contributions").html("");
		}
	}else{
		//The user has contributed mote to the Requirements Bazaar
		$("#platforms_main").html("Requirements Bazaar");
		$("#main_number_contributions").html(contrib_req_baz);
		if(contrib_mediawiki>0){
			$("#platforms_additional").html("Layers Mediawiki");
			$("#additional_number_contributions").html("(with "+contrib_mediawiki+" contributions)");
		}else{
			$("#platforms_additional").html("No other platform");
			$("#additional_number_contributions").html("");
		}
	}
}

/*
 * Determine the time when the person has made the most contributions to the Layers MediaWiki
 */
function NOSE_determine_time_active(){
	if(cur_sel_dev_saved_mediawiki === ""){
		$("#active_around").html("could not determine");
	}else{
		var paramsJSON = new Array();
		paramsJSON[0] = {"type": "String", "value": "layerswiki"};
		paramsJSON[1] = {"type": "String", "value": "select cur.realname, cur.editTimes from (SELECT SUBSTRING(cast(rev.rev_timestamp AS CHAR(255) CHARACTER SET utf8),9,2) as editTimes, cast(user.user_real_name AS CHAR(255) CHARACTER SET utf8) as realname, count(rev.rev_id) as count FROM layerswiki.revision rev, layerswiki.user user where rev.rev_user=user.user_id Group by editTimes, realname Order by realname, editTimes) cur where not exists (select * from (SELECT SUBSTRING(cast(rev.rev_timestamp AS CHAR(255) CHARACTER SET utf8),9,2) as editTimes, cast(user.user_real_name AS CHAR(255) CHARACTER SET utf8) as realname, count(rev.rev_id) as count FROM layerswiki.revision rev, layerswiki.user user where rev.rev_user=user.user_id Group by editTimes, realname Order by realname, editTimes) high where high.realname = cur.realname and high.count > cur.count) and cur.realname ='"+cur_sel_dev_saved_mediawiki+"' group by realname"};
		lasClient.invoke('nose-monitoring-dashboard', 'executeQuery',paramsJSON, function(status, result) {
			if(JSON.parse(result.value).length === 0){
				$("#active_around").html("could not determine");
			}else{
				// Time is returned in format 0-24 which is not so pretty
				var time = JSON.parse(result.value)[0].editTimes;
				if(time < 12){
					$("#active_around").html(time + " AM (UTC)");
				}else if(time == 12){
					$("#active_around").html(time + " PM (UTC)");
				}else{
					$("#active_around").html((time-12) + " PM (UTC)");
				}
			}
		});
	}
}





