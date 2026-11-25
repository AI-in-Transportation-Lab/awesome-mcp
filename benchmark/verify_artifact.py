#!/usr/bin/env python3
"""Exercise the real stdio MCP servers; fails on incorrect behavior.

This verifies a synthetic demonstration, not human authorization, physical
safety, real ROS 2 integration, or hard real-time operation.
"""
import asyncio
import json
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = Path(__file__).resolve().parent

async def verify_server(script, check):
    params = StdioServerParameters(command=sys.executable, args=[str(HERE / script)])
    updates = []
    async def on_message(message):
        message = getattr(message, 'root', message)
        if getattr(message, 'method', '') == 'notifications/resources/updated':
            updates.append(str(message.params.uri))
    async with stdio_client(params) as streams:
        async with ClientSession(*streams, message_handler=on_message) as client:
            init = await client.initialize()
            await check(client, init, updates)

async def tool(client, name, arguments):
    result = await client.call_tool(name, arguments)
    assert not result.is_error, (name, result.content)
    return result.structured_content

async def mapek(client, init, updates):
    assert str(client.protocol_version) == '2025-11-25'
    names = {x.name for x in (await client.list_tools()).tools}
    assert names == {'ingest_observation', 'analyze', 'plan', 'execute'}
    assert init.capabilities.resources.subscribe
    await client.subscribe_resource("context://knowledge/links")
    await client.subscribe_resource("context://knowledge/agents")
    await tool(client, 'ingest_observation', {'link_id':'RSU-23-RSU-24','latency_ms':42,'loss':0.03})
    assert (await tool(client, 'analyze', {}))['symptoms']
    bad = await tool(client,'plan',{'goal':'invalid rate','target_agents':['veh-101'],'new_send_rate_hz':1})
    assert bad['status'] == 'rejected'
    assert not (await tool(client,'execute',{'plan_id':bad['plan_id']}))['applied']
    unknown = await tool(client,'plan',{'goal':'unknown','target_agents':['absent']})
    assert unknown['status'] == 'rejected'
    stale = await tool(client,'plan',{'goal':'stale','target_agents':['veh-101'],'new_send_rate_hz':4})
    await tool(client,'ingest_observation',{'link_id':'RSU-23-RSU-24','latency_ms':50,'loss':0.03})
    result = await tool(client,'execute',{'plan_id':stale['plan_id']})
    assert not result['applied'] and 'stale' in result['reason']
    good = await tool(client,'plan',{'goal':'apply','target_agents':['veh-101'],'new_send_rate_hz':4})
    assert (await tool(client,'execute',{'plan_id':good['plan_id']}))['applied']
    assert not (await tool(client,'execute',{'plan_id':good['plan_id']}))['applied']
    resource = await client.read_resource('context://knowledge/agents')
    assert json.loads(resource.contents[0].text)['agents']['veh-101']['send_rate_hz'] == 4
    mode = await tool(client,'plan',{'goal':'mode gate','target_agents':['veh-101'],'new_mode':'autonomous'})
    assert not (await tool(client,'execute',{'plan_id':mode['plan_id']}))['applied']
    # Demonstrates the limitation: a caller can set this Boolean itself.
    assert (await tool(client,'execute',{'plan_id':mode['plan_id'],'confirm':True}))['applied']
    assert (await client.get_prompt('explain_adaptation', {'plan_id':mode['plan_id']})).messages
    await asyncio.sleep(0.1)
    assert len(updates) >= 2
    await client.unsubscribe_resource('context://knowledge/links')
    count = len(updates)
    await tool(client,'ingest_observation',{'link_id':'RSU-23-RSU-24','latency_ms':15,'loss':0.001})
    await asyncio.sleep(0.1)
    assert len(updates) == count, 'unsubscribed resource still notified'
    print('PASS MAPE-K: protocol handshake, listing, observation, safety rejection, unknown target, stale-plan rejection, apply/readback, replay rejection, confirmation argument, prompt, per-URI subscribe/unsubscribe and update notifications')
    print('LIMIT: confirm=True is not authenticated human approval; modern subscriptions/listen was not exercised')

async def bridge(client, init, updates):
    await asyncio.sleep(0.15)
    result = await client.read_resource('context://ros/objects/summary')
    summary = json.loads(result.contents[0].text)
    assert summary['version'] > 0 and summary['n_frames'] > 0
    state = await tool(client,'set_supervisory_param',{'name':'send_rate_hz','value':'8'})
    assert state['ok'] and state['value'] == 8
    assert not (await tool(client,'set_supervisory_param',{'name':'unsupported','value':'8'}))['ok']
    assert not (await tool(client,'set_supervisory_param',{'name':'send_rate_hz','value':'-1'}))['ok']
    result = await tool(client,'request_replan',{'reason':'verification'})
    assert result['ok']
    print('PASS bridge: summary resource, supervisory parameter allow-list, invalid-rate rejection, replan interface')
    print('ROS 2 actuation exercised:', state['applied_to_ros'], '; ROS replan published:', result['published'])

async def main():
    await verify_server('mcp_mapek_server.py', mapek)
    await verify_server('ros2_mcp_bridge.py', bridge)

if __name__ == '__main__':
    asyncio.run(asyncio.wait_for(main(), timeout=45))
