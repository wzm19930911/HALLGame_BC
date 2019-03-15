/// 替换该地址
var UIRLFILE = "http://xxxxxxxx/demo/update/";
const SubgameManager = {
    _storagePath: [],//本地路径
    _fileName: "", //文件名
    _failCount: 0, //下载失败文件数 用于设置一个失败的限制
    _updating: false, //是否在更新中
    _downloadCallback: null,//下载进度回调
    _finishCallback: null, //检查配置或更新结束回调
    /**
     * 从服务器获取资源
     * @param {string} name - 游戏名
     * @param type - 当前模式 1下载资源 2 检查配置文件 3检查是否有更新
     * @param downloadCallback - 下载进度回调
     * @param finishCallback - 检查配置或更新结束回调
    */
    _getfiles: function (name, type, downloadCallback, finishCallback) {
        this._storagePath[name] = ((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'ALLGame/');
        this._downloadCallback = downloadCallback;
        this._finishCallback = finishCallback;
        this._fileName = name;
        let filees = this._storagePath[name] + name + '_project.manifest';
        /*自定义manifest 
        * 当获取不到子游戏的manifest的时候使用自定义去拉取整个游戏
        */
        let customManifestStr = JSON.stringify({
            'packageUrl': UIRLFILE,
            'remoteManifestUrl': UIRLFILE + "manifest/" + name + '_project.manifest',
            'remoteVersionUrl': UIRLFILE + "manifest/" + name + '_version.manifest',
            'version': '0.0.1',
            'assets': {},
            'searchPaths': []
        });
        //判断文件本地文件是否存在 如果存在就用本地文件去查找热更
        if (jsb.fileUtils.isFileExist(filees)) {
            this._am = new jsb.AssetsManager(filees, this._storagePath[name], this._versionCompareHandle);
        } else {
            this._am = new jsb.AssetsManager("", this._storagePath[name], this._versionCompareHandle);
        }
        //设置下载内容校验
        this._am.setVerifyCallback(function (path, asset) {
            var compressed = asset.compressed;
            if (compressed) {
                return true;
            } else {
                return true;
            }
        });
        //当前如果是安卓版本，那么设置当前下载任务最大2
        if (cc.sys.os === cc.sys.OS_ANDROID) {
            this._am.setMaxConcurrentTask(2);
        }
        //设置回调函数
        if (type === 1) {
            this._am.setEventCallback(this._updateCb.bind(this));
        } else if (type == 2) {
            this._am.setEventCallback(this._checkCb.bind(this));
        } else {
            this._am.setEventCallback(this._needUpdate.bind(this));
        }
        //如果当前配置文件还未加载 那么设置为自定义配置
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            let manifest = new jsb.Manifest(customManifestStr, this._storagePath[name]);
            this._am.loadLocalManifest(manifest, this._storagePath[name]);
        }
        if (type === 1) {
            this._am.update(); //开始更新资源
            this._failCount = 0; //初始化失败文件数
        } else {
            this._am.checkUpdate(); //检查更新
        }
        this._updating = true;
        cc.log('更新文件:' + filees);
    },
    /**
     * 热更新回调
     */
    _updateCb: function (event) {
        let failed = false;
        let self = this;
        let updateCom = false;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                cc.log('updateCb本地没有配置文件'); //本地没有配置文件
                failed = true;
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
                cc.log('updateCb下载配置文件错误'); //下载配置文件错误
                failed = true;
                break;
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                cc.log('updateCb解析文件错误'); //解析文件错误
                failed = true;
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                cc.log('updateCb发现新的更新'); //有更新
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                cc.log('updateCb当前已经是最新的'); //当前已经是最新的
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                self._downloadCallback && self._downloadCallback(event.getPercentByFile()); //回调下载进度
                break;
            case jsb.EventAssetsManager.ASSET_UPDATED:
                //需要更新
                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                cc.log('updateCb更新错误');//更新错误
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                updateCom = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                self._failCount++;
                if (self._failCount <= 10) { //失败下载数比较少
                    self._am.downloadFailedAssets(); //调用接口进行重新下载 也可以单独放到外面由玩家主动发起
                    cc.log(('updateCb更新失败' + this._failCount + ' 次'));
                } else {
                    cc.log(('updateCb失败次数过多'));
                    self._failCount = 0;
                    failed = true;
                    self._updating = false;
                }
                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                cc.log('updateCb解压失败'); //解压失败
                break;
        }
        if (failed) {
            this._am.setEventCallback(null);//清空回调
            self._updating = false;
            self._finishCallback && self._finishCallback(false);
        }
        if (updateCom == true) {
            updateCom = false;
            this._am.setEventCallback(null); //清空回调
            //获取本地manifest文件中的搜索路径
            /*let newPaths = self._am.getLocalManifest().getSearchPaths();
            //下面这句才是正确的
            let searchPaths = jsb.fileUtils.getSearchPaths();
            searchPaths.unshift(newPaths.toString());
            //之后将搜索路径,存到本地的数据库中,开启游戏时,从本地数据库中拿到搜索路径
            cc.sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
            //设置搜索路径
            jsb.fileUtils.setSearchPaths(searchPaths);*/
            //修改文件名
            if (jsb.fileUtils.isFileExist(jsb.fileUtils.getWritablePath() + "ALLGame/project.manifest")) {
                this.renameFile(this._fileName);
            } else {
                /*if (jsb.fileUtils.isFileExist(jsb.fileUtils.getWritablePath() + "ALLGame_temp/project.manifest")) {
                    cc.log("还在缓存文件夹里");
                }*/
                cc.log("文件不存在" + jsb.fileUtils.getWritablePath() + "ALLGame/project.manifest");
            }
            self._finishCallback && self._finishCallback(true);
        }
    },
    /**
     * 版本对比函数
     */
    _versionCompareHandle: function (versionA, versionB) {
        let vA = versionA.split('.');
        let vB = versionB.split('.');
        for (let i = 0; i < vA.length; ++i) {
            let a = parseInt(vA[i]);
            let b = parseInt(vB[i] || 0);
            if (a === b) {
                continue;
            } else {
                return a - b;
            }
        }
        if (vB.length > vA.length) {
            return -1;
        } else {
            return 0;
        }
    },
    // type = 2
    _checkCb: function (event) {
        var failed = false;
        let self = this;
        let updateCom = false;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                cc.log('checkCb本地没有配置文件');
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
                cc.log('checkCb下载配置文件错误');
                failed = true;
                break;
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                cc.log('checkCb解析文件错误');
                failed = true;
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                self._getfiles(self._fileName, 1, self._downloadCallback, self._finishCallback); //开始更新
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                cc.log('checkCb已经是最新的');
                self._finishCallback && self._finishCallback(true);
                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                break;
            case jsb.EventAssetsManager.ASSET_UPDATED:
                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                cc.log('checkCb更新错误');
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                cc.log('checkCb更新完成');
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                cc.log('checkCb更新失败');
                failed = true;
                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                cc.log('checkCb解压失败');
                break;

        }
        this._updating = false;
        if (failed) {
            self._finishCallback && self._finishCallback(false);
        }
    },
    _needUpdate: function (event) {
        let self = this;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                cc.log('子游戏已经是最新的，不需要更新');
                self._finishCallback && self._finishCallback(false);
                break;

            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                cc.log('子游戏需要更新');
                self._finishCallback && self._finishCallback(true);
                break;

            // 检查是否更新出错
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
            case jsb.EventAssetsManager.ERROR_UPDATING:
            case jsb.EventAssetsManager.UPDATE_FAILED:
                self._downloadCallback();
                break;
        }
    },
    /**
     * 下载子游戏
     * @param {string} name - 游戏名
     * @param progress - 下载进度回调
     * @param finish - 完成回调
     * @note finish 返回true表示下载成功，false表示下载失败
     */
    downloadSubgame: function (name, progress, finish) {
        this._getfiles(name, 2, progress, finish);
    },
    /**
     * 进入子游戏
     * @param {string} name - 游戏名
     */
    enterSubgame: function (name) {
        if (!this._storagePath[name]) {
            this.downloadSubgame(name);
            return;
        }
        cc.director.loadScene(name);
    },
    /**
     * 判断子游戏是否已经下载
     * @param {string} name - 游戏名
     */
    isSubgameDownLoad: function (name) {
        let file = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'ALLGame/' + name + '_project.manifest';
        if (jsb.fileUtils.isFileExist(file)) {
            return true;
        } else {
            return false;
        }
    },
    /**
     * 判断子游戏是否需要更新 可以通过遍历来判断整个大厅子游戏的状态
     * @param {string} name - 游戏名
     * @param isUpdateCallback - 是否需要更新回调
     * @param failCallback - 错误回调
     * @note isUpdateCallback 返回true表示需要更新，false表示不需要更新
     */
    needUpdateSubgame: function (name, isUpdateCallback, failCallback) {
        this._getfiles(name, 3, failCallback, isUpdateCallback);
    },
    /*
    *重命名文件 从默认的project更改为{模块}+"_project"
    * jsb.fileUtils.renameFile不能用 真是坑
    */
    //重命名文件 从默认的projec jsb.fileUtils.renameFile不能用 真是坑
    renameFile: function (name) {
        let projectStr = jsb.fileUtils.getStringFromFile(jsb.fileUtils.getWritablePath() + "ALLGame/project.manifest");
        let projectDic = JSON.parse(projectStr);
        jsb.fileUtils.writeStringToFile(JSON.stringify(projectDic), jsb.fileUtils.getWritablePath() + "ALLGame/" + name + "_project.manifest");
    }
};

module.exports = SubgameManager;