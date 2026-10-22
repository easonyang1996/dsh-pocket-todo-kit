package com.personalai.pocketexecutor.wxapi;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.personalai.pocketexecutor.ExecutorState;
import com.personalai.pocketexecutor.LaunchParams;
import com.tencent.mm.opensdk.modelbase.BaseReq;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;

public final class WXEntryActivity extends Activity implements IWXAPIEventHandler {
    private IWXAPI api;
    @Override public void onCreate(Bundle state){super.onCreate(state);handle(getIntent());}
    @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
    private void handle(Intent intent){
        String id=ExecutorState.prefs(this).getString("appId","");
        if(!LaunchParams.validAppId(id)){ExecutorState.log(this,"收到回调，但没有配置有效移动应用 AppID");finish();return;}
        if(api!=null)api.detach();api=WXAPIFactory.createWXAPI(this,id,true);
        try {if(!api.handleIntent(intent,this)){ExecutorState.log(this,"回调未通过 OpenSDK handleIntent 检查");finish();}}
        catch(Exception e){ExecutorState.log(this,"回调解析失败："+e.getClass().getSimpleName());finish();}
    }
    @Override public void onReq(BaseReq req){ExecutorState.log(this,"收到微信请求 type="+req.getType()+"；测试器不执行此请求");finish();}
    @Override public void onResp(BaseResp resp){
        String error=resp.errStr==null?"":resp.errStr.replace('\n',' ');if(error.length()>300)error=error.substring(0,300);
        ExecutorState.log(this,"onResp type="+resp.getType()+" errCode="+resp.errCode+" errStr="+error);
        if(resp instanceof WXLaunchMiniProgram.Resp)ExecutorState.log(this,"小程序返回回调已收到；extMsg内容不写日志；不将回调当作打开页面的即时证明");
        finish();
    }
    @Override public void onDestroy(){if(api!=null)api.detach();super.onDestroy();}
}
