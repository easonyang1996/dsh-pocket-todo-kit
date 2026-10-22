package com.personalai.pocketexecutor.test;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import com.personalai.pocketexecutor.*;
public class AdmissionTests extends Instrumentation {
 private int checks;
 private void check(boolean value,String name){if(!value)throw new AssertionError(name);checks++;}
 private void reject(String raw)throws Exception{try{LaunchParams.fromJson(raw);}catch(Exception expected){checks++;return;}throw new AssertionError("accepted invalid JSON");}
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){Bundle result=new Bundle();MainActivity activity=null;try{
 check(!LaunchParams.validAppId(""),"empty AppID");check(!LaunchParams.validAppId("gh_45b306365c3d"),"raw id not caller AppID");check(LaunchParams.validAppId("wx0123456789abcdef"),"AppID format");
 LaunchParams p=LaunchParams.fromJson("{\"kind\":\"wechat_mini_program\",\"userName\":\"gh_45b306365c3d\"}");check(p.type==0&&p.path.equals(""),"default homepage");
 reject("{\"kind\":\"app\",\"userName\":\"gh_123\"}");reject("{\"kind\":\"wechat_mini_program\",\"userName\":\"wx123\"}");reject("{\"kind\":\"wechat_mini_program\",\"userName\":\"gh_123\",\"miniprogramType\":3}");reject("{\"kind\":\"wechat_mini_program\",\"userName\":\"gh_123\",\"platform\":\"ios\"}");
 Intent intent=new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);activity=(MainActivity)startActivitySync(intent);final MainActivity a=activity;
 runOnMainSync(()->{a.appIdForTest("");check(!a.sendEnabledForTest(),"send disabled without AppID");a.appIdForTest("wx0123456789abcdef");check(a.sendEnabledForTest(),"send enabled for valid parameters");a.appIdForTest("");try{a.loadJson("{\"kind\":\"wechat_mini_program\",\"userName\":\"gh_da88f6188665\"}");check(a.targetForTest().equals("gh_da88f6188665"),"import target");try{a.loadJson("{}");throw new AssertionError("bad import accepted");}catch(Exception expected){check(a.targetForTest().equals("gh_da88f6188665"),"invalid import preserves target");}}catch(Exception e){throw new RuntimeException(e);}});
 result.putString("stream","PASS: "+checks+" checks; no SDK requests sent\n");finish(-1,result);
 }catch(Throwable e){result.putString("stream","FAIL: "+e.toString());finish(0,result);}finally{if(activity!=null){final MainActivity a=activity;runOnMainSync(a::finish);}}}
}
