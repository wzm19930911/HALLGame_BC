const SubgameManager = require('SubgameManager');  //子游戏管理

const name = 'Hg';
cc.Class({
    extends: cc.Component,

    properties: {
        downloadBtn: cc.Node,
        downloadLabel: cc.Label
    },
    start: function () {
        this.initSubGame();
    },
    initSubGame: function () {
        let self = this;
        //判断子游戏有没有下载
        if (SubgameManager.isSubgameDownLoad(name)) {
            //已下载，判断是否需要更新
            SubgameManager.needUpdateSubgame(name, function (success) {
                if (success) {
                    self.downloadLabel.string = "当前子游戏需要更新";
                } else {
                    self.downloadLabel.string = "当前子游戏不需要更新";
                }
            }, function () {
                cc.log('出错了');
            });
        } else {
            self.downloadLabel.string = "当前子游戏未下载";
        }
    },
    //点击下载游戏
    onClickDownLoad: function () {
        //下载子游戏/更新子游戏
        let self = this;
        SubgameManager.downloadSubgame(name, function (progress) {
            if (isNaN(progress)) {
                progress = 0;
            }
            self.downloadLabel.string = "资源下载中   " + parseInt(progress * 100) + "%";
        }, function (success) {
            if (success) {
                SubgameManager.enterSubgame(name);
            } else {
                cc.log('下载失败');
            }
        });
    },
    //点击打开
    open: function () {
        let Subgame = SubgameManager.isSubgameDownLoad(name);
        cc.log("sure" + Subgame);
        if (Subgame == true) {
            SubgameManager.enterSubgame(name);
        }
    },
    //加载场景
    onLoadScene: function () {
        cc.director.loadScene("Hg");
    },
    // called every frame
    update: function (dt) {

    },
});
