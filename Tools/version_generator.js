var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var manifest = {
    packageUrl: 'http://xxx/demo/update/',
    remoteManifestUrl: 'http://xxx/demo/update/',
    remoteVersionUrl: 'http://xxx/demo/update/',
    version: '1.0.0',
    assets: {},
    searchPaths: []
};

var dest = './update/';
var src = './jsb/';

var mod = ""
//新增 
var module_dic = {};

// Parse arguments
var i = 2;
while (i < process.argv.length) {
    var arg = process.argv[i];

    switch (arg) {
        case '--url':
        case '-u':
            var url = process.argv[i + 1];
            manifest.packageUrl = url;
            manifest.remoteManifestUrl = url + 'project.manifest';
            manifest.remoteVersionUrl = url + 'version.manifest';
            i += 2;
            break;
        case '--version':
        case '-v':
            manifest.version = process.argv[i + 1];
            i += 2;
            break;
        case '--src':
        case '-s':
            src = process.argv[i + 1];
            i += 2;
            break;
        case '--dest':
        case '-d':
            dest = process.argv[i + 1];
            i += 2;
            break;
        case '-mod':
            mod = process.argv[i + 1];
            i += 2;
			manifest.remoteManifestUrl += "manifest/"+mod+'_project.manifest';
			manifest.remoteVersionUrl += "manifest/"+mod+'_version.manifest';
            break;
        default:
            i++;
            break;
    }
}


function readDir(dir, obj) {
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
        return;
    }
    var subpaths = fs.readdirSync(dir), subpath, size, md5, compressed, relative;
    for (var i = 0; i < subpaths.length; ++i) {
        if (subpaths[i][0] === '.') {
            continue;
        }
        subpath = path.join(dir, subpaths[i]);
        stat = fs.statSync(subpath);
        if (stat.isDirectory()) {
            readDir(subpath, obj);
        }
        else if (stat.isFile()) {
            // Size in Bytes
            size = stat['size'];
            md5 = crypto.createHash('md5').update(fs.readFileSync(subpath, 'binary')).digest('hex');
            compressed = path.extname(subpath).toLowerCase() === '.zip';
            relative = path.relative(src, subpath);
            relative = relative.replace(/\\/g, '/');
            relative = encodeURI(relative);
            let name_str = path.basename(relative);
            name_str = name_str.split(".")[0];
            console.log("name_str:"+name_str);
            console.log("module_dic[name_str]:"+module_dic[name_str])
            if (module_dic.hasOwnProperty(name_str)) {
                obj[relative] = {
                    'size': size,
                    'md5': md5
                };
                if (compressed) {
                    obj[relative].compressed = true;
                }
				fs.unlink(relative,function(error){
					if(error){
					}
					console.log('删除文件成功');
				})

            }
        }
    }
}
function readConfig() {
    let config_arr = fs.readFileSync('./config.json', "utf-8");
    config_arr = JSON.parse(config_arr);//将字符串转换为json对象
    let build_arr = fs.readFileSync('./buildJson.json', "utf-8");
    build_arr = JSON.parse(build_arr);//将字符串转换为json对象
    for (let i = 0; i < build_arr.length; i++) {
        let build_dic = build_arr[i];
        let url = build_dic["url"];
        let uuid = build_dic["uuid"];

        for (let j = 0; j < config_arr.length; j++) {
            let config_dic = config_arr[j];
            let path_str = config_dic["path"];
            let module_str = config_dic["module"];
            if (module_str == mod) {
                if (url.indexOf(path_str) != -1) {
                    console.log("uuid:"+uuid);
                    module_dic[uuid] = true;
                }
            }
        }
    }
}
readConfig();

var mkdirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
}


// Iterate res and src folder
readDir(path.join(src, 'src'), manifest.assets);
readDir(path.join(src, 'res'), manifest.assets);

var destManifest = path.join(dest, mod+'_project.manifest');
var destVersion = path.join(dest, mod+'_version.manifest');

mkdirSync(dest);

fs.writeFile(destManifest, JSON.stringify(manifest), (err) => {
    if (err) throw err;
    console.log('Manifest successfully generated');
});

delete manifest.assets;
delete manifest.searchPaths;
fs.writeFile(destVersion, JSON.stringify(manifest), (err) => {
    if (err) throw err;
    console.log('Version successfully generated');
});